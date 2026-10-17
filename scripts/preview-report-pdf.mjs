import { build, stop } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = resolve('tmp/pdfs/report-preview')
await mkdir(dir, { recursive: true })
await mkdir('output/pdf', { recursive: true })
await build({ entryPoints: { renderer: 'src/lib/reportPdf.ts', fixture: 'scripts/reports-validation-mocks.tsx' },
  outdir: dir, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', outExtension: { '.js': '.mjs' },
  define: { 'process.env.NODE_ENV': '"production"' } })
stop()
globalThis.window = {}
const { buildReportPdf } = await import(pathToFileURL(resolve(dir, 'renderer.mjs')).href)
const { getReportsData, getReportProductsForExport } = await import(pathToFileURL(resolve(dir, 'fixture.mjs')).href)
const snapshot = await getReportsData({ preset: 'custom', startDate: '2026-05-01', endDate: '2026-10-17' })
snapshot.monthlyData = [120000, 180000, 240000, 190000, 200000, 300000].map((revenue, index) => ({
  month: ['mai 26', 'juin 26', 'juil. 26', 'août 26', 'sept. 26', 'oct. 26'][index], revenue, profit: revenue * 0.4,
}))
const products = await getReportProductsForExport(snapshot)
const business = { name: 'Commerce Demonstration', address: 'Dakar, Senegal - Donnees fictives', phone: '77 000 00 00', ninea: 'DEMO-2026' }
const generatedAt = new Date('2026-10-17T17:00:00Z')
const logoPng = await readFile('public/brand/logo-saytu-yef-mark-v2.png')
await writeFile('output/pdf/rapport-demonstration.pdf', await buildReportPdf({ snapshot, products, business, generatedAt, logoPng }))

const stress = structuredClone(snapshot)
stress.monthlyData = Array.from({ length: 24 }, (_, index) => ({ month: `Periode ${index + 1}`, revenue: 200000, profit: index % 2 ? 40000 : -50000 }))
stress.totalInvoiced = 9876543210987
const stressProducts = products.map((product, index) => ({ ...product, name: index === 0 ? 'ReferenceSansEspace'.repeat(250) : `${product.name} - Reference longue pour verification des retours a la ligne`, profit: -4000, margin: -40 }))
await writeFile(resolve(dir, 'stress.pdf'), await buildReportPdf({ snapshot: stress, products: stressProducts, business, generatedAt }))
const empty = structuredClone(snapshot)
for (const key of ['monthlyData', 'paymentMethodData', 'topClients', 'sellerBreakdown']) empty[key] = []
for (const key of ['totalInvoiced', 'totalCollected', 'cashCollected', 'totalDue', 'salesCount', 'totalSold', 'averageTicket', 'collectionRate', 'completedCount', 'partialCount', 'estimatedProfitCount']) empty[key] = 0
await writeFile(resolve(dir, 'empty.pdf'), await buildReportPdf({ snapshot: empty, products: [], business, generatedAt }))
console.log('PDF demonstration and stress/empty fixtures generated with fictitious data only.')
