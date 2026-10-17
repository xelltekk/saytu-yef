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

const dir = resolve('tmp/reports-validation')
await mkdir(dir, { recursive: true })
const mock = resolve('scripts/reports-validation-mocks.tsx')
await build({ entryPoints: ['scripts/reports-validation.tsx'], outfile: resolve(dir, 'bundle.js'), bundle: true, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, alias: { '@': resolve('src'),
    '@/hooks/useUser': mock, '@/hooks/useAccountRole': mock, '@/lib/supabase/queries': mock,
    '@/lib/supabase/reports': mock, '@/components/layout/Header': mock,
    '@/components/sales/CashSessionPanel': mock, 'next/link': mock } })
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
    const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, reducedMotion: 'reduce' })
    await context.route('https://**/*', (route) => route.abort())
    await context.route('https://reports-fixture.invalid/logo.png', async (route) => route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: await readFile('public/brand/logo-saytu-yef-mark-v2.png') }))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    const exportButton = page.getByRole('button', { name: 'Exporter CSV', exact: true })
    const pdfButton = page.getByRole('button', { name: 'Exporter PDF', exact: true })
    await expect(exportButton).toBeEnabled()
    const range = page.getByRole('combobox', { name: 'Période du rapport', exact: true })
    await range.selectOption('today')
    await page.waitForFunction(() => window.reportCalls.includes('today'))
    await range.selectOption('7d')
    await expect(exportButton).toBeEnabled()
    await page.waitForFunction(() => window.reportCompleted.includes('today'))
    const downloadPromise = page.waitForEvent('download')
    await exportButton.click()
    const download = await downloadPromise
    const csvPath = resolve(dir, `reports-${width}.csv`)
    await download.saveAs(csvPath)
    const csv = await readFile(csvPath, 'utf8')
    assert.equal((csv.match(/Produit fictif /g) ?? []).length, 123)
    assert(csv.includes('"7d","1230000","492000"'), 'Export must match the latest range, not a late older response')
    assert(csv.includes('"Encaissements recus pendant la periode (FCFA)","900000"'))
    await page.getByRole('combobox', { name: 'Filtrer par vendeur', exact: true }).selectOption('seller')
    await expect(page.getByText('Vue filtree sur Vendeur test.', { exact: false })).toBeVisible()
    await range.selectOption('custom')
    await page.getByLabel('Date de debut', { exact: true }).fill('2026-01-01')
    await page.getByLabel('Date de fin', { exact: true }).fill('2026-12-31')
    await expect(exportButton).toBeEnabled()
    const pdfDownload = page.waitForEvent('download')
    await pdfButton.click()
    const pdf = await pdfDownload
    assert(pdf.suggestedFilename() === 'rapport-2026-01-01-au-2026-12-31-Vendeur-test.pdf', 'PDF must use the effective period and seller')
    await pdf.saveAs(resolve(dir, `reports-${width}.pdf`))
    await expect(page.getByRole('status')).toHaveText('Rapport PDF téléchargé.')
    if (width === 360) {
      await context.route('https://reports-fixture.invalid/logo.png', (route) => route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }), { times: 1 })
      const withoutLogo = page.waitForEvent('download')
      await pdfButton.click()
      await (await withoutLogo).saveAs(resolve(dir, 'report-without-logo.pdf'))
      await expect(page.getByRole('status')).toHaveText('PDF téléchargé sans logo : image indisponible.')
    }
    // A filter change must invalidate a pending export, not download stale data.
    let unexpectedDownload = false
    const watchDownload = () => { unexpectedDownload = true }
    page.on('download', watchDownload)
    await page.evaluate(() => { window.reportExportDelay = 300 })
    await pdfButton.click()
    await expect(pdfButton).toBeDisabled()
    await range.selectOption('month')
    await expect(pdfButton).toBeEnabled()
    await page.evaluate(() => { window.reportExportDelay = 30 })
    assert.equal(unexpectedDownload, false, 'Cancelled PDF must not download')
    page.off('download', watchDownload)
    await page.evaluate(() => { window.reportFailExport = true })
    await pdfButton.click()
    await expect(page.getByText('Les ventes ou versements ont change.', { exact: false })).toBeVisible()
    await page.evaluate(() => { window.reportFailExport = false })
    await range.selectOption('custom')
    await expect(pdfButton).toBeEnabled()
    await expect(page.locator('.recharts-surface')).not.toHaveCount(0)
    await page.waitForFunction(() => {
      const bars = [...document.querySelectorAll('.recharts-bar-rectangle path')]
      const sectors = [...document.querySelectorAll('.recharts-pie-sector path')]
      return bars.length >= 2 && bars.every((bar) => bar.getBoundingClientRect().height > 20)
        && sectors.length >= 6 && sectors.every((sector) => sector.getBoundingClientRect().width > 2)
    })
    await page.screenshot({ path: resolve(dir, `reports-viewport-${width}.png`) })
    const charts = page.locator('.recharts-wrapper')
    assert.equal(await charts.count(), 2)
    assert.equal(await charts.nth(0).evaluate((chart) => {
      const left = chart.getBoundingClientRect().left
      return [...chart.querySelectorAll('.recharts-yAxis text')].some((tick) => tick.getBoundingClientRect().left < left)
    }), false, 'Full monetary axis labels must not be clipped')
    await charts.nth(0).screenshot({ path: resolve(dir, `revenue-chart-${width}.png`) })
    await charts.nth(1).screenshot({ path: resolve(dir, `products-chart-${width}.png`) })
    await page.screenshot({ path: resolve(dir, `reports-${width}.png`), fullPage: true })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    let staleRoleDownload = false
    const watchRoleDownload = () => { staleRoleDownload = true }
    page.on('download', watchRoleDownload)
    await page.evaluate(() => { window.reportExportDelay = 300 })
    await pdfButton.click()
    await page.evaluate(() => window.reportRole('cashier'))
    await expect(page.getByRole('combobox', { name: 'Filtrer par vendeur', exact: true })).toHaveCount(0)
    await expect(page.getByText('Rapport personnel caisse', { exact: false })).toBeVisible()
    await expect(exportButton).toBeEnabled()
    await page.evaluate(() => { window.reportExportDelay = 30 })
    assert.equal(staleRoleDownload, false, 'Role change must cancel the former scope PDF')
    page.off('download', watchRoleDownload)
    assert.equal(errors.length, 0, errors.join('\n'))
    const cashierPdfDownload = page.waitForEvent('download')
    await pdfButton.click()
    await (await cashierPdfDownload).saveAs(resolve(dir, `cashier-${width}.pdf`))
    assert.equal(errors.length, 0, errors.join('\n'))
    console.log(`PASS ${width}px: full CSV/PDF, seller and cashier scope, cancellation, export errors, dates, charts and no overflow.`)
    await context.close()
  }
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
