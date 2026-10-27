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
const dir = resolve('tmp/abroad-transfer-validation')
await mkdir(dir, { recursive: true })
await build({ entryPoints: ['scripts/abroad-transfer-validation.tsx'], outfile: resolve(dir, 'bundle.js'), bundle: true, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@': resolve('src'), '@/lib/supabase/queries': resolve('scripts/abroad-transfer-validation-mocks.ts'), 'next/link': resolve('scripts/abroad-transfer-validation-mocks.ts') } })
stop()
await writeFile(resolve(dir, 'styles.css'), (await postcss([tailwind()]).process(await readFile('src/app/globals.css', 'utf8'), { from: resolve('src/app/globals.css') })).css)
const server = createServer(async (req, res) => {
  if (req.url === '/bundle.js' || req.url === '/styles.css') {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css')
    res.end(await readFile(resolve(dir, req.url.slice(1))))
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
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const width of [360, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 360 ? 640 : 900 } })
    await context.route('https://**/*', (route) => route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message) })
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    try { await page.getByRole('button', { name: 'Transferer', exact: true }).click() } catch (error) {
      console.error(await page.locator('body').innerText())
      await page.screenshot({ path: resolve(dir, `failure-${width}.png`), fullPage: true })
      throw error
    }
    const modal = page.getByRole('dialog', { name: 'Transferer vers le stock principal' })
    const quantity = modal.getByLabel('Quantite a transferer', { exact: true })
    await expect(quantity).toHaveValue('10')
    await quantity.fill('11')
    await expect(modal.getByText(/La quantite depasse le reste a transferer\./)).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Transferer', exact: true })).toBeDisabled()
    await quantity.fill('4')
    await modal.getByLabel('Prix de vente (FCFA)', { exact: true }).fill('2500')
    await page.screenshot({ path: resolve(dir, `transfer-${width}.png`), fullPage: true })
    const button = modal.getByRole('button', { name: 'Transferer', exact: true })
    const box = await button.boundingBox()
    assert(box && box.x >= 0 && box.x + box.width <= width && box.y + box.height <= page.viewportSize().height)
    if (width === 360) {
      await page.setViewportSize({ width, height: 480 })
      const short = await button.boundingBox()
      assert(short && short.y >= 0 && short.y + short.height <= 480)
      await page.screenshot({ path: resolve(dir, 'transfer-short-360.png'), fullPage: true })
      await page.setViewportSize({ width, height: 640 })
    }
    await page.evaluate(() => window.abroadFixture.lostReply())
    await button.click()
    await expect(modal.getByRole('alert')).toContainText('Reponse reseau perdue')
    await button.click()
    await expect(modal).toHaveCount(0)
    await expect(page.getByText('Transfere : 4 · Reste : 6', { exact: true })).toBeVisible()
    assert.equal(await page.evaluate(() => window.abroadFixture.writes()), 1)
    await page.getByRole('button', { name: 'Transferer le reste', exact: true }).click()
    await expect(quantity).toHaveValue('6')
    await expect(modal.getByLabel('Prix de vente (FCFA)', { exact: true })).toHaveCount(0)
    await button.click()
    await expect(modal).toHaveCount(0)
    await expect(page.getByText('Aucun article pour cette selection', { exact: true })).toBeVisible()
    await page.getByLabel('Etat du transfert', { exact: true }).selectOption('completed')
    await expect(page.getByText('Transfere : 10 · Reste : 0', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: "Supprimer l'article", exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /^Historique de / }).click()
    const history = page.getByRole('dialog', { name: 'Historique des transferts', exact: true })
    await expect(history.getByRole('listitem')).toHaveCount(2)
    await page.screenshot({ path: resolve(dir, `history-${width}.png`), fullPage: true })
    await history.getByRole('button', { name: 'Fermer', exact: true }).click()
    await page.getByLabel('Rechercher une saisie', { exact: true }).fill('introuvable')
    await expect(page.getByText('Aucun article pour cette selection', { exact: true })).toBeVisible()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    const snapshot = await page.evaluate(() => window.abroadFixture.snapshot())
    assert.equal(snapshot.destination.quantity, 10)
    assert.equal(snapshot.receipts.length, 2)
    assert.deepEqual(errors, [])
    console.log(`Transferts ${width}px : quantites, reprise reseau, reliquat, historique et debordements OK`)
    await context.close()
  }
} finally { await browser?.close(); server.close(); await once(server, 'close') }
