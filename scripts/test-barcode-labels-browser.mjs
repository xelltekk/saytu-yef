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

const dir = resolve('tmp/barcode-labels-validation')
await mkdir(dir, { recursive: true })
await build({ entryPoints: ['scripts/barcode-labels-validation.tsx'], outfile: resolve(dir, 'bundle.js'), bundle: true, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, alias: { '@': resolve('src') } })
stop()
const css = await postcss([tailwind()]).process(await readFile('src/app/globals.css', 'utf8'), { from: resolve('src/app/globals.css') })
await writeFile(resolve(dir, 'styles.css'), css.css)
const server = createServer(async (req, res) => {
  if (req.url === '/bundle.js' || req.url === '/styles.css') {
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
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const width of [360, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true })
    await context.route('https://**/*', (route) => route.abort())
    await context.addInitScript(() => { window.print = () => document.documentElement.setAttribute('data-printed', 'true') })
    const page = await context.newPage()
    const errors = []; page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('4 variante(s) selectionnee(s)')
    await expect(dialog).not.toContainText('FCFA')
    await expect(dialog).not.toContainText('999998')
    const copies = dialog.locator('input[type=number]')
    await copies.first().fill('32')
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exporter PDF (35)', exact: true }).click()
    await (await downloading).saveAs(resolve(dir, `labels-${width}.pdf`))
    await page.screenshot({ path: resolve(dir, `modal-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Imprimer 35 etiquette(s)', exact: true }).click()
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame())
    await frame.locator('html[data-printed=true]').waitFor({ state: 'attached' })
    const html = await frame.locator('html').evaluate((element) => element.outerHTML)
    assert.equal((await frame.locator('article').count()), 35)
    assert.ok(!html.includes('label-price') && !html.includes('FCFA') && !html.includes('999998'))
    const preview = await context.newPage()
    await preview.setViewportSize({ width: 800, height: 1130 })
    await preview.setContent(html)
    await preview.emulateMedia({ media: 'print' })
    const measurements = await preview.locator('article').first().evaluate((element) => {
      const box = element.getBoundingClientRect()
      return { width: box.width * 25.4 / 96, height: box.height * 25.4 / 96 }
    })
    assert.ok(Math.abs(measurements.width - 48) < 0.05 && Math.abs(measurements.height - 30) < 0.05)
    const clipped = await preview.locator('.barcode-value').evaluateAll((elements) => elements.some((e) => e.scrollWidth > e.clientWidth + 1))
    assert.equal(clipped, false, 'Human-readable codes must not be clipped')
    await preview.pdf({ path: resolve(dir, `print-${width}.pdf`), preferCSSPageSize: true, printBackground: true })
    await preview.screenshot({ path: resolve(dir, `sheet-${width}.png`), fullPage: true })
    assert.deepEqual(errors, [])
    console.log(`PASS ${width}px: no prices, 35 selected copies in print/PDF, 48 x 30 mm and full barcode numbers.`)
    await context.close()
  }
} finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)) }
