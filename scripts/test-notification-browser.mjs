import { build, stop } from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import assert from 'node:assert/strict'

const dir = resolve('tmp/notification-validation')
await mkdir(dir, { recursive: true })
const mock = resolve('scripts/notification-validation-mocks.tsx')
await build({ entryPoints: ['scripts/notification-validation.tsx'], outfile: resolve(dir, 'bundle.js'), bundle: true, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, alias: { '@': resolve('src'),
    '@/hooks/useUser': mock, '@/hooks/useAccountRole': mock, '@/lib/supabase/queries': mock,
    '@/lib/supabase/catalogue': mock, '@/lib/supabase/client': mock, 'next/navigation': mock, 'next/link': mock,
    '@/components/inventory/ProductTable': mock, '@/components/inventory/AddProductModal': mock,
    '@/components/inventory/AbroadBatchEntry': mock } })
stop()
const css = await postcss([tailwind()]).process(await readFile('src/app/globals.css', 'utf8'), { from: resolve('src/app/globals.css') })
await writeFile(resolve(dir, 'styles.css'), css.css)
const server = createServer(async (req, res) => {
  if (req.url === '/bundle.js' || req.url === '/styles.css') {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css')
    res.end(await readFile(resolve(dir, req.url.slice(1))))
  } else if (req.url === '/product.png') {
    res.setHeader('Content-Type', 'image/png')
    res.end(await readFile('public/brand/logo-saytu-yef-mark-v2.png'))
  } else {
    res.setHeader('Content-Type', 'text/html;charset=utf-8')
    res.end('<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')
  }
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const require = createRequire(import.meta.url)
const runtime = resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
const { chromium } = require(require.resolve('playwright', { paths: [runtime] }))
const { expect } = require(require.resolve('playwright/test', { paths: [runtime] }))
const firstId = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const width of [360, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 360 ? 640 : 900 } })
    await context.route('https://**/*', (route) => route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/inventory?keep=1`)
    await page.getByRole('button', { name: 'Notifications', exact: true }).click()
    const low = page.getByRole('link', { name: /Stock faible: Iphone 8/ })
    await expect(low).toHaveAttribute('href', `/inventory?product=${firstId}`)
    await low.click()
    const details = page.getByRole('dialog', { name: 'Fiche produit', exact: true })
    await expect(details.getByText('Noir', { exact: true })).toBeVisible()
    await expect(details.getByText('5 unite(s)', { exact: true })).toHaveCount(2)
    await expect(details.locator('img')).toBeVisible()
    assert.equal(await page.evaluate(() => window.notificationFixture.writes()), 0)
    await page.screenshot({ path: resolve(dir, `details-${width}.png`) })
    assert.equal(await details.evaluate((element) => element.scrollWidth > element.clientWidth + 1), false)
    const bounds = await details.getByRole('button', { name: 'Ajuster le stock' }).boundingBox()
    assert(bounds && bounds.y + bounds.height <= page.viewportSize().height, 'Footer must remain visible on a short smartphone')
    await details.getByRole('button', { name: 'Ajuster le stock' }).click()
    const adjustment = page.getByRole('dialog', { name: 'Ajuster le stock' })
    await expect(adjustment).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await adjustment.getByRole('button', { name: 'Confirmer' }).click()
    await expect(details.getByText('6 unite(s)', { exact: true })).toBeVisible()
    assert.equal(await page.evaluate(() => window.notificationFixture.writes()), 1)
    await details.getByRole('button', { name: 'Modifier', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Modification produit' })).toContainText('2 variantes')
    await page.getByRole('button', { name: 'Terminer' }).click()
    await page.getByRole('button', { name: 'Notifications', exact: true }).click()
    await page.getByRole('link', { name: /Rupture: Iphone 8/ }).click()
    await expect(details.getByText('Blanc', { exact: true })).toBeVisible()
    await expect(details.getByText('0 unite(s)', { exact: true })).toBeVisible()
    await page.evaluate(() => window.notificationFixture.role('cashier'))
    await expect(details.getByText('Blanc', { exact: true })).toBeVisible()
    await expect(details.getByRole('button', { name: 'Modifier' })).toHaveCount(0)
    await expect(details.getByRole('button', { name: 'Ajuster le stock' })).toHaveCount(0)
    await page.screenshot({ path: resolve(dir, `cashier-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(details).toHaveCount(0)
    // Direct links, preserved unrelated parameters and same-page target changes.
    await page.evaluate((id) => window.notificationFixture.navigate(`/inventory?keep=1&product=${id}`), secondId)
    await expect(details.getByText('Blanc', { exact: true })).toBeVisible()
    await details.getByRole('button', { name: 'Fermer', exact: true }).last().click()
    await expect(page).toHaveURL(/\/inventory\?keep=1$/)
    await page.goBack()
    await expect(details).toHaveCount(0)
    await page.evaluate(() => window.notificationFixture.navigate('/inventory?product=deleted'))
    await expect(details.getByRole('alert')).toContainText("Ce produit n'est plus disponible")
    await page.evaluate(() => window.notificationFixture.fail(true))
    await page.evaluate((id) => window.notificationFixture.navigate(`/inventory?product=${id}`), firstId)
    await expect(details.getByRole('alert')).toHaveText('Connexion indisponible')
    await page.evaluate(() => { window.notificationFixture.fail(false); window.notificationFixture.delay(250) })
    await page.evaluate((id) => window.notificationFixture.navigate(`/inventory?product=${id}`), secondId)
    await expect(details.getByRole('status')).toBeVisible()
    await page.evaluate((id) => window.notificationFixture.navigate(`/inventory?product=${id}`), firstId)
    await expect(details.getByText('Noir', { exact: true })).toBeVisible()
    await expect(details.getByText('Blanc', { exact: true })).toHaveCount(0)
    assert.equal(errors.length, 0, errors.join('\n'))
    console.log(`PASS ${width}px: bell click, exact variants, edit/adjust, cashier permissions, missing/error states, cancellation and visible footer.`)
    await context.close()
  }
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
