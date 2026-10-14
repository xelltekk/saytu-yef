import { useSyncExternalStore, type ComponentProps } from 'react'
import type { ReportSnapshot, ReportsRangeInput } from '../src/lib/reports'

let role = 'admin'
const listeners = new Set<() => void>()
const user = { id: 'seller', user_metadata: {} }
const calls: string[] = []
const completed: string[] = []
const products = Array.from({ length: 123 }, (_, index) => ({
  id: `p${index}`, name: `Produit fictif ${String(index + 1).padStart(3, '0')}`,
  sold: 2, revenue: 10000, profit: 4000, margin: 40,
}))
const seller = { sellerId: 'seller', sellerName: 'Vendeur test', sellerEmail: 'test@example.invalid',
  sellerRole: 'cashier' as const, salesCount: 123, totalSold: 246, totalInvoiced: 1230000,
  totalCollected: 1000000, totalDue: 230000, averageTicket: 10000, collectionRate: 81.3, lastSaleAt: null }
const client = { key: 'client', name: 'Client fictif', phone: '', salesCount: 123,
  invoiced: 1230000, collected: 1000000, due: 230000, collectionRate: 81.3 }
Object.assign(window, { reportCalls: calls, reportCompleted: completed, reportRole(next: string) {
  role = next
  listeners.forEach((listener) => listener())
} })
export function useUser() { return { user, accountOwnerId: 'owner' } }
export function useAccountRole() {
  const current = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, () => role)
  return { role: current, isCashier: current === 'cashier' }
}
export function Header({ title }: { title: string }) { return <header className="p-4"><h1>{title}</h1></header> }
export function CashSessionPanel() { return null }
export default function Link(props: ComponentProps<'a'>) { return <a {...props} /> }
export async function getReportsData(input: ReportsRangeInput): Promise<ReportSnapshot> {
  calls.push(input.preset)
  // The older response deliberately ignores cancellation to exercise the page guard.
  await new Promise((resolve) => setTimeout(resolve, input.preset === 'today' ? 450 : 15))
  completed.push(input.preset)
  return {
    ownerId: 'owner', version: 'fixture', appliedSellerId: role === 'cashier' ? 'seller' : input.sellerId ?? null,
    request: { start: '2026-01-01T00:00:00Z', endExclusive: '2026-07-01T00:00:00Z', granularity: 'month', timeZone: 'UTC', sellerId: input.sellerId ?? null },
    monthlyData: [{ month: input.preset, revenue: 1230000, profit: 492000 }],
    topProducts: products.slice(0, 10), paymentMethodData: [{ method: 'cash', count: 123, invoiced: 1230000, collected: 900000, due: 230000 }],
    topClients: [client], totalSold: 246, avgMargin: 40, totalInvoiced: 1230000, totalCollected: 1000000,
    cashCollected: 900000, estimatedProfitCount: 1, totalDue: 230000, salesCount: 123, averageTicket: 10000,
    collectionRate: 81.3, completedCount: 100, partialCount: 23, pendingCount: 0,
    bestMonth: { month: input.preset, revenue: 1230000, profit: 492000 }, bestProductByUnits: products[0],
    bestProductByProfit: products[0], bestClientByRevenue: client, highestDueClient: client,
    sellerBreakdown: [seller], sellerOptions: [{ id: 'seller', label: 'Vendeur test', role: 'cashier' }],
  }
}
export async function getReportProductsForExport(_snapshot: ReportSnapshot, signal?: AbortSignal) {
  await new Promise((resolve) => setTimeout(resolve, 30))
  if (signal?.aborted) throw new Error('Export annule')
  return products
}
export async function getCashSessionContext() { return { activeSession: null, history: [] } }
export async function openCashSession() { throw new Error('Ecriture interdite dans cette recette') }
export const closeCashSession = openCashSession
