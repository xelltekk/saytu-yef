import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildReportPdf, getReportPdfFilename, getReportPeriodLabel, getReportSellerLabel } from './reportPdf'
import type { ReportSnapshot } from './reports'

function fixture(): ReportSnapshot {
  return {
    ownerId: 'owner', version: 'v1', appliedSellerId: null,
    request: { start: '2026-09-01T00:00:00Z', endExclusive: '2026-10-01T00:00:00Z', granularity: 'day', timeZone: 'UTC', sellerId: null },
    monthlyData: [], topProducts: [], paymentMethodData: [], topClients: [], totalSold: 0, avgMargin: 0,
    totalInvoiced: 0, totalCollected: 0, cashCollected: 0, estimatedProfitCount: 0, totalDue: 0, salesCount: 0,
    averageTicket: 0, collectionRate: 0, completedCount: 0, partialCount: 0, pendingCount: 0,
    bestMonth: null, bestProductByUnits: null, bestProductByProfit: null, bestClientByRevenue: null,
    highestDueClient: null, sellerBreakdown: [], sellerOptions: [],
  }
}

describe('report PDF', () => {
  it('uses the effective inclusive dates and seller of the loaded snapshot', () => {
    const snapshot = fixture()
    expect(getReportPeriodLabel(snapshot)).toBe('Du 01 septembre 2026 au 30 septembre 2026')
    expect(getReportPdfFilename(snapshot)).toBe('rapport-2026-09-01-au-2026-09-30.pdf')
    snapshot.appliedSellerId = 'cashier'
    snapshot.sellerOptions = [{ id: 'cashier', label: 'Amélie / Caisse', role: 'cashier' }]
    expect(getReportSellerLabel(snapshot)).toBe('Amélie / Caisse')
    expect(getReportPdfFilename(snapshot)).toBe('rapport-2026-09-01-au-2026-09-30-Amelie-Caisse.pdf')
  })
  it('honours the snapshot timezone across midnight and uses a fallback for a removed seller', () => {
    const snapshot = fixture()
    snapshot.request.timeZone = 'America/New_York'
    snapshot.request.start = '2026-09-01T04:00:00Z'
    snapshot.request.endExclusive = '2026-10-01T04:00:00Z'
    snapshot.appliedSellerId = 'removed'
    expect(getReportPdfFilename(snapshot)).toBe('rapport-2026-09-01-au-2026-09-30-Vendeur-selectionne.pdf')
  })
  it('builds a valid A4 report without sales or logo', async () => {
    const bytes = await buildReportPdf({ snapshot: fixture(), products: [], business: { name: 'Boutique test' }, generatedAt: new Date('2026-10-17T17:00:00Z') })
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(3)
    expect(pdf.getTitle()).toContain('Boutique test')
    expect(pdf.getCreationDate()?.toISOString()).toBe('2026-10-17T17:00:00.000Z')
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28)
      expect(page.getHeight()).toBeCloseTo(841.89)
    }
  })
  it('paginates all products and tolerates long names, unsupported symbols and losses', async () => {
    const snapshot = fixture()
    snapshot.monthlyData = Array.from({ length: 24 }, (_, index) => ({ month: `Periode ${index + 1}`, revenue: 100000, profit: -5000 }))
    snapshot.estimatedProfitCount = 2
    const products = Array.from({ length: 123 }, (_, index) => ({ id: String(index), name: `Produit ${index + 1} - ${'Longue reference '.repeat(index === 0 ? 300 : 3)} 🍽`, sold: 2, revenue: 100000, profit: -5000, margin: -5 }))
    const bytes = await buildReportPdf({ snapshot, products, business: { name: 'Societe de demonstration' } })
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBeGreaterThan(8)
    expect(pdf.getPageCount()).toBeLessThan(30)
  })
})
