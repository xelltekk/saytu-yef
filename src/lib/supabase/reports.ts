import { getAccountContext } from './account'
import { createClient, ensureBrowserSupabaseSession } from './client'
import { resolveReportsRange, type ReportRequest, type ReportProduct, type ReportSnapshot, type ReportsRangeInput, type ReportsData } from '@/lib/reports'
import { dateInputValue, isBusinessOwner, type ExpenseSummary } from '@/lib/expenses'
import { getExpensesPage, verifyExpenseSummary } from './expenses'

type RawSummary = Omit<ReportsData, 'monthlyData' | 'bestMonth'> & {
  ownerId: string; version: string
  monthlyData: { key: string; revenue: number; profit: number }[]
  bestMonth: { key: string; revenue: number; profit: number } | null
}
type ProductCursor = { id: string; revenue: string }
type ProductPage = { ownerId: string; version: string; appliedSellerId: string | null; products: ReportProduct[]; totalProducts: number; nextCursor: ProductCursor | null }

function periodLabel(key: string) {
  const [year,month,day]=key.split('-').map(Number)
  return new Date(year,month-1,day ?? 1).toLocaleDateString('fr-FR',day === undefined
    ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' })
}

async function readReport<T extends { ownerId: string; appliedSellerId: string | null }>(options: ReportRequest & { mode?: string; after?: ProductCursor; limit?: number }, signal?: AbortSignal) {
  const account = await getAccountContext()
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  const request = client.rpc('get_reports_summary',{ p_options: account.member?.role === 'cashier'
    ? { ...options, sellerId:account.user.id } : options })
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new Error('La migration des rapports agreges doit etre appliquee dans Supabase.')
    throw new Error(error.message)
  }
  const current = await getAccountContext()
  const ownerId = account.business?.id ?? account.user.id
  if (current.user.id !== account.user.id || (current.business?.id ?? current.user.id) !== ownerId
    || current.member?.role !== account.member?.role || data?.ownerId !== ownerId
    || (account.member?.role === 'cashier' && data.appliedSellerId !== account.user.id)) {
    throw new Error('Session modifiee, veuillez reessayer')
  }
  return data as T
}

export async function getReportsData(input: number | ReportsRangeInput = 6, signal?: AbortSignal): Promise<ReportSnapshot> {
  const range = resolveReportsRange(input)
  const request: ReportRequest = {
    start: range.start.toISOString(), endExclusive: range.endExclusive.toISOString(), granularity: range.granularity,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    sellerId: typeof input === 'number' ? null : input.sellerId ?? null,
  }
  const raw = await readReport<RawSummary>(request,signal)
  const account = await getAccountContext()
  if ((account.business?.id ?? account.user.id) !== raw.ownerId) throw new Error('Session modifiee, veuillez reessayer')
  let expenses: ExpenseSummary | undefined
  if (!raw.appliedSellerId && isBusinessOwner(account.user.id,account.business?.id,account.member?.role)) {
    const result = await getExpensesPage({ startDate:dateInputValue(range.start),endExclusive:dateInputValue(range.endExclusive),limit:1 },signal)
    if (result.ownerId !== raw.ownerId) throw new Error('Session modifiee, veuillez reessayer')
    const { ownerId,startDate,endExclusive,version,count,total,byCategory,byMonth } = result
    expenses = { ownerId,startDate,endExclusive,version,count,total,byCategory,byMonth }
  }
  return { ...raw, request, expenses,
    monthlyData: raw.monthlyData.map((bucket) => ({ month:periodLabel(bucket.key),revenue:bucket.revenue,profit:bucket.profit })),
    bestMonth: raw.bestMonth ? { month:periodLabel(raw.bestMonth.key),revenue:raw.bestMonth.revenue,profit:raw.bestMonth.profit } : null,
  }
}

export async function getReportProductsForExport(snapshot: ReportSnapshot, signal?: AbortSignal) {
  if (snapshot.expenses) {
    if (snapshot.appliedSellerId || snapshot.expenses.ownerId !== snapshot.ownerId) throw new Error('Perimetre du rapport de depenses invalide.')
    await verifyExpenseSummary(snapshot.expenses,signal)
  }
  const products: ReportProduct[] = []
  let after: ProductCursor | undefined
  for (;;) {
    if (signal?.aborted) throw new Error('Export annule')
    const page = await readReport<ProductPage>({ ...snapshot.request, mode:'products', after, limit:50 },signal)
    if (page.ownerId !== snapshot.ownerId || page.version !== snapshot.version || page.appliedSellerId !== snapshot.appliedSellerId) {
      throw new Error('Les ventes ou versements ont change. Actualisez le rapport avant de relancer l\'export.')
    }
    products.push(...page.products)
    if (products.length >= page.totalProducts) {
      if (snapshot.expenses) await verifyExpenseSummary(snapshot.expenses,signal)
      return products
    }
    const next = page.nextCursor
    if (!next || (next.id === after?.id && next.revenue === after.revenue)) throw new Error('Export incomplet, veuillez reessayer.')
    after = next
  }
}
