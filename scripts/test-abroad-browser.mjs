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

const dir = resolve('tmp/abroad-validation')
await mkdir(dir, { recursive: true })
await build({ entryPoints: ['scripts/abroad-validation.tsx'], outfile: resolve(dir, 'bundle.js'), bundle: true, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@': resolve('src'), '@/lib/supabase/queries': resolve('scripts/abroad-validation-mocks.ts'),
    'next/link': resolve('scripts/abroad-validation-mocks.ts') } })
stop()
const css = await postcss([tailwind()]).process(await readFile('src/app/globals.css', 'utf8'), { from: resolve('src/app/globals.css') })
await writeFile(resolve(dir, 'styles.css'), css.css)
const photo = await readFile('public/brand/logo-saytu-yef-mark-v2.png')
const server = createServer(async (req, res) => {
  if (req.url === '/photo.png') { res.setHeader('Content-Type', 'image/png'); res.end(photo) }
  else if (req.url === '/bundle.js' || req.url === '/styles.css') {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css')
    res.end(await readFile(resolve(dir, req.url.slice(1))))
  } else {
    res.setHeader('Content-Type', 'text/html;charset=utf-8')
    res.end('<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')
  }
})
server.listen(0, '127.0.0.1'); await once(server, 'listening')
const require = createRequire(import.meta.url)
const runtime = resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
const { chromium } = require(require.resolve('playwright', { paths: [runtime] }))
const { expect } = require(require.resolve('playwright/test', { paths: [runtime] }))
const upload = (scope) => scope.getByLabel('Charger une photo du produit').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: photo })
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('saytu-inventory')).state.abroadProducts)
async function connectivity(page, online) {
  await page.evaluate((online) => {
    localStorage.setItem('test-offline', online ? 'no' : 'yes')
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  }, online)
}
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const width of [360, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.route('https://**/*', (route) => route.abort())
    await context.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => localStorage.getItem('test-offline') === 'no' }))
    const page = await context.newPage()
    const errors = []; page.on('pageerror', (error) => { errors.push(error.message); console.error(error.stack) })
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
    await page.getByLabel('Charger une photo du produit').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })
    await expect(page.getByRole('alert')).toContainText('image')
    await upload(page)
    await expect(page.getByAltText('Apercu du produit')).toBeVisible()
    await page.getByRole('button', { name: 'Retirer la photo' }).click()
    await expect(page.getByAltText('Apercu du produit')).toHaveCount(0)
    await upload(page)
    await page.getByLabel('Nom du produit').fill('Telephone voyage')
    await page.getByLabel("Prix d'achat").fill('75000')
    await page.screenshot({ path: resolve(dir, `add-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Enregistrer localement' }).click()
    await expect(page.getByAltText('Telephone voyage', { exact: true })).toBeVisible()
    assert.match((await stored(page))[0].image_url, /^data:image\/jpeg;base64,/)
    await page.reload()
    await expect(page.getByAltText('Telephone voyage', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: "Modifier l'article" }).click()
    await expect(page.getByRole('dialog').getByAltText('Apercu du produit')).toBeVisible()
    await page.getByRole('dialog').getByLabel('Nom du produit').fill('Telephone modifie')
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByAltText('Telephone modifie', { exact: true })).toBeVisible()
    await page.evaluate(() => { window.failAbroadUpload = true })
    await connectivity(page, true)
    await page.getByRole('button', { name: 'Synchroniser', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Test upload failure')
    assert.match((await stored(page))[0].image_url, /^data:image\/jpeg;base64,/)
    assert.equal((await stored(page))[0].synced, false)
    await page.evaluate(() => { window.failAbroadUpload = false })
    await page.getByRole('button', { name: 'Synchroniser', exact: true }).click()
    await expect(page.getByText('Synchronise', { exact: true })).toBeVisible()
    assert.equal((await stored(page))[0].image_url, '/photo.png')
    assert.equal((await stored(page)).length, 1)
    await page.getByRole('button', { name: "Modifier l'article" }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Retirer la photo' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByAltText('Telephone modifie', { exact: true })).toHaveCount(0)
    assert.equal((await stored(page))[0].image_url, null)
    await page.getByRole('button', { name: "Modifier l'article" }).click()
    assert.equal(await page.getByLabel('Prendre une photo du produit').getAttribute('capture'), 'environment')
    await page.getByLabel('Prendre une photo du produit').setInputFiles({ name: 'camera.png', mimeType: 'image/png', buffer: photo })
    await expect(page.getByRole('dialog').getByAltText('Apercu du produit')).toBeVisible()
    await page.screenshot({ path: resolve(dir, `edit-${width}.png`), fullPage: true })
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByAltText('Telephone modifie', { exact: true })).toBeVisible()
    await page.screenshot({ path: resolve(dir, `list-${width}.png`), fullPage: true })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await page.getByRole('button', { name: 'Transferer', exact: true }).click()
    await page.getByLabel('Prix de vente (FCFA)').fill('100000')
    await page.getByRole('dialog').getByRole('button', { name: 'Transferer', exact: true }).click()
    await expect(page.getByText('Aucun article a activer', { exact: true })).toBeVisible()
    assert.equal(await page.evaluate(() => window.abroadAudit.find((item) => item.action === 'transfer').product.image_url), '/photo.png')
    assert.deepEqual(errors, [])
    console.log(`PASS ${width}px: photo selection/removal/camera input, offline persistence, failed/retried sync, edits and photo retained on inventory transfer.`)
    await context.close()
  }
} finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)) }
