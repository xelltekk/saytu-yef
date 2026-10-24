import type { TeamMember } from '@/types'
import type { ExpenseSummary } from './expenses'

export type ReportsRangePreset = 'today' | '7d' | '30d' | 'month' | '3m' | '6m' | '12m' | 'custom'

export type ReportsRangeInput = {
  preset: ReportsRangePreset
  startDate?: string | null
  endDate?: string | null
  sellerId?: string | null
}

export type ReportsSellerOption = {
  id: string
  label: string
  role: TeamMember['role']
}

export type ReportsSellerBreakdown = {
  sellerId: string
  sellerName: string
  sellerEmail: string
  sellerRole: TeamMember['role']
  salesCount: number
  totalSold: number
  totalInvoiced: number
  totalCollected: number
  totalDue: number
  averageTicket: number
  collectionRate: number
  lastSaleAt: string | null
}

type ReportsBucketGranularity = 'day' | 'month'

const REPORTS_DAY_MS = 24 * 60 * 60 * 1000

function toStartOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function parseDateInput(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null

  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0,0,0,0)
  return date.getFullYear()===year && date.getMonth()===month-1 && date.getDate()===day ? date : null
}

export function resolveReportsRange(input: number | ReportsRangeInput) {
  const today = toStartOfDay(new Date())

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input>120) throw new Error('Periode de rapport invalide (10 ans maximum)')
    const monthCount = Math.max(1, Math.floor(input))
    return {
      start: new Date(today.getFullYear(), today.getMonth() - monthCount + 1, 1),
      endExclusive: addDays(today, 1),
      granularity: 'month' as ReportsBucketGranularity,
    }
  }

  let start = new Date(today.getFullYear(), today.getMonth() - 5, 1)
  let endExclusive = addDays(today, 1)

  switch (input.preset) {
    case 'today':
      start = today
      break
    case '7d':
      start = addDays(today, -6)
      break
    case '30d':
      start = addDays(today, -29)
      break
    case 'month':
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      break
    case '3m':
      start = new Date(today.getFullYear(), today.getMonth() - 2, 1)
      break
    case '6m':
      start = new Date(today.getFullYear(), today.getMonth() - 5, 1)
      break
    case '12m':
      start = new Date(today.getFullYear(), today.getMonth() - 11, 1)
      break
    case 'custom': {
      const parsedStart = parseDateInput(input.startDate)
      const parsedEnd = parseDateInput(input.endDate ?? input.startDate)

      if (!parsedStart || !parsedEnd) {
        throw new Error('Choisissez une date de debut et une date de fin pour le rapport personnalise.')
      }

      if (parsedStart.getTime() > parsedEnd.getTime()) {
        throw new Error('La date de debut doit etre anterieure ou egale a la date de fin.')
      }

      start = toStartOfDay(parsedStart)
      endExclusive = addDays(toStartOfDay(parsedEnd), 1)
      break
    }
  }

  const spanDays = Math.max(1, Math.ceil((endExclusive.getTime() - start.getTime()) / REPORTS_DAY_MS))
  const granularity: ReportsBucketGranularity = spanDays <= 45 ? 'day' : 'month'

  return { start, endExclusive, granularity }
}


export interface ReportsData {
  monthlyData: { month: string; revenue: number; profit: number }[]
  topProducts: { id: string; name: string; sold: number; revenue: number; profit: number; margin: number }[]
  paymentMethodData: { method: 'cash' | 'wave' | 'orange_money' | 'card'; count: number; invoiced: number; collected: number; due: number }[]
  topClients: { key: string; name: string; phone: string; salesCount: number; invoiced: number; collected: number; due: number; collectionRate: number }[]
  totalSold: number
  avgMargin: number
  totalInvoiced: number
  totalCollected: number
  cashCollected: number
  estimatedProfitCount: number
  totalDue: number
  salesCount: number
  averageTicket: number
  collectionRate: number
  completedCount: number
  partialCount: number
  pendingCount: number
  bestMonth: { month: string; revenue: number; profit: number } | null
  bestProductByUnits: { id: string; name: string; sold: number; revenue: number; profit: number; margin: number } | null
  bestProductByProfit: { id: string; name: string; sold: number; revenue: number; profit: number; margin: number } | null
  bestClientByRevenue: { key: string; name: string; phone: string; salesCount: number; invoiced: number; collected: number; due: number; collectionRate: number } | null
  highestDueClient: { key: string; name: string; phone: string; salesCount: number; invoiced: number; collected: number; due: number; collectionRate: number } | null
  sellerBreakdown: {
    sellerId: string
    sellerName: string
    sellerEmail: string
    sellerRole: 'admin' | 'employee' | 'cashier'
    salesCount: number
    totalSold: number
    totalInvoiced: number
    totalCollected: number
    totalDue: number
    averageTicket: number
    collectionRate: number
    lastSaleAt: string | null
  }[]
  sellerOptions: {
    id: string
    label: string
    role: 'admin' | 'employee' | 'cashier'
  }[]
  appliedSellerId: string | null
}


export type ReportRequest = { start: string; endExclusive: string; granularity: 'day' | 'month'; timeZone: string; sellerId: string | null }
export type ReportProduct = ReportsData['topProducts'][number]
export type ReportSnapshot = ReportsData & { ownerId: string; version: string; request: ReportRequest; expenses?: ExpenseSummary }
