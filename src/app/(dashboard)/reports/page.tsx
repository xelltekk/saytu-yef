'use client'
import { useCallback, useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, MetricCard } from '@/components/ui/Card'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { TrendingUp, Package, DollarSign, BarChart3, Download, RefreshCw, Wallet, Receipt, TriangleAlert, Target, Users, CreditCard, Smartphone } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { getReportsData, type ReportsRangeInput, type ReportsRangePreset } from '@/lib/supabase/queries'
import { useAccountRole } from '@/hooks/useAccountRole'

const COLORS = ['#6C5CE7', '#8b5cf6', '#f97316', '#10b981', '#0ea5e9', '#94a3b8']
const PAYMENT_METHOD_META = {
  cash: { label: 'Especes', color: '#10b981', icon: Wallet },
  wave: { label: 'Wave', color: '#6C5CE7', icon: Smartphone },
  orange_money: { label: 'Orange Money', color: '#f97316', icon: Smartphone },
  card: { label: 'Carte', color: '#0ea5e9', icon: CreditCard },
} as const
const REPORT_RANGE_OPTIONS: Array<{ value: ReportsRangePreset; label: string }> = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: 'month', label: 'Mois en cours' },
  { value: '3m', label: '3 derniers mois' },
  { value: '6m', label: '6 derniers mois' },
  { value: '12m', label: '12 derniers mois' },
  { value: 'custom', label: 'Periode personnalisee' },
]

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDateRangePart(value: string) {
  return parseDateInput(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getRangeLabel(preset: ReportsRangePreset, startDate: string, endDate: string) {
  switch (preset) {
    case 'today':
      return "aujourd'hui"
    case '7d':
      return '7 derniers jours'
    case '30d':
      return '30 derniers jours'
    case 'month':
      return 'mois en cours'
    case '3m':
      return '3 derniers mois'
    case '6m':
      return '6 derniers mois'
    case '12m':
      return '12 derniers mois'
    case 'custom':
      return `${formatDateRangePart(startDate)} au ${formatDateRangePart(endDate)}`
  }
}

function getRangeSentence(preset: ReportsRangePreset, startDate: string, endDate: string) {
  switch (preset) {
    case 'today':
      return "d'aujourd'hui"
    case '7d':
      return 'des 7 derniers jours'
    case '30d':
      return 'des 30 derniers jours'
    case 'month':
      return 'du mois en cours'
    case '3m':
      return 'des 3 derniers mois'
    case '6m':
      return 'des 6 derniers mois'
    case '12m':
      return 'des 12 derniers mois'
    case 'custom':
      return `du ${formatDateRangePart(startDate)} au ${formatDateRangePart(endDate)}`
  }
}

function getRangeSlug(preset: ReportsRangePreset, startDate: string, endDate: string) {
  if (preset === 'custom') {
    return `${startDate}_au_${endDate}`
  }

  return preset
}

interface ReportsData {
  monthlyData: { month: string; revenue: number; profit: number }[]
  allProducts: { id: string; name: string; sold: number; revenue: number; profit: number; margin: number }[]
  topProducts: { id: string; name: string; sold: number; revenue: number; profit: number; margin: number }[]
  paymentMethodData: { method: 'cash' | 'wave' | 'orange_money' | 'card'; count: number; invoiced: number; collected: number; due: number }[]
  topClients: { key: string; name: string; phone: string; salesCount: number; invoiced: number; collected: number; due: number; collectionRate: number }[]
  totalSold: number
  avgMargin: number
  totalInvoiced: number
  totalCollected: number
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
}

export default function ReportsPage() {
  const { isCashier } = useAccountRole()
  const [rangePreset, setRangePreset] = useState<ReportsRangePreset>('6m')
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 29)
    return toDateInputValue(date)
  })
  const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()))
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadReports = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const rangeInput: ReportsRangeInput = {
        preset: rangePreset,
        startDate: customStartDate,
        endDate: customEndDate,
      }
      setData(await getReportsData(rangeInput) as ReportsData)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Impossible de charger les rapports')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [customEndDate, customStartDate, rangePreset])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const totalRevenue = data?.monthlyData.reduce((s, m) => s + m.revenue, 0) ?? 0
  const totalProfit = data?.monthlyData.reduce((s, m) => s + m.profit, 0) ?? 0
  const totalSold = data?.totalSold ?? 0
  const avgMargin = data?.avgMargin ?? 0
  const totalInvoiced = data?.totalInvoiced ?? 0
  const totalCollected = data?.totalCollected ?? 0
  const totalDue = data?.totalDue ?? 0
  const salesCount = data?.salesCount ?? 0
  const averageTicket = data?.averageTicket ?? 0
  const collectionRate = data?.collectionRate ?? 0
  const completedCount = data?.completedCount ?? 0
  const partialCount = data?.partialCount ?? 0
  const pendingCount = data?.pendingCount ?? 0
  const bestMonth = data?.bestMonth ?? null
  const bestProductByUnits = data?.bestProductByUnits ?? null
  const bestProductByProfit = data?.bestProductByProfit ?? null
  const paymentMethods = data?.paymentMethodData ?? []
  const topClients = data?.topClients ?? []
  const bestClientByRevenue = data?.bestClientByRevenue ?? null
  const highestDueClient = data?.highestDueClient ?? null
  const collectionFollowUpCount = partialCount + pendingCount
  const rangeLabel = getRangeLabel(rangePreset, customStartDate, customEndDate)
  const rangeSentence = getRangeSentence(rangePreset, customStartDate, customEndDate)

  const renderResponsiveCurrency = (amount: number) => (
    <>
      <span className="sm:hidden">{formatCurrencyCompact(amount)}</span>
      <span className="hidden sm:inline">{formatCurrency(amount)}</span>
    </>
  )

  const leadingProducts = data?.topProducts.slice(0, 5) ?? []
  const leadingRevenue = leadingProducts.reduce((sum, product) => sum + product.revenue, 0)
  const categoryData = leadingProducts.map((product, index) => ({
    id: product.id,
    name: product.name,
    value: product.revenue,
    percentage: Math.round((product.revenue / (totalRevenue || 1)) * 100),
    color: COLORS[index],
  }))
  if (totalRevenue - leadingRevenue > 0.01) {
    categoryData.push({
      id: 'other',
      name: 'Autres produits',
      value: totalRevenue - leadingRevenue,
      percentage: Math.max(0, 100 - categoryData.reduce((sum, item) => sum + item.percentage, 0)),
      color: COLORS[5],
    })
  }

  const exportCsv = () => {
    if (!data) return

    const protectSpreadsheetCell = (value: string | number) => {
      const text = String(value)
      const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safeText.replace(/"/g, '""')}"`
    }
    const rows: Array<Array<string | number>> = [
      ['Rapport Saytu Yef', rangeLabel],
      [],
      ['Pilotage'],
      ['Ventes', data.salesCount],
      ['Montant facture (FCFA)', Math.round(data.totalInvoiced)],
      ['Montant encaisse (FCFA)', Math.round(data.totalCollected)],
      ['Solde client (FCFA)', Math.round(data.totalDue)],
      ['Ticket moyen (FCFA)', Math.round(data.averageTicket)],
      ['Taux d encaissement (%)', data.collectionRate.toFixed(2)],
      ['Ventes reglees', data.completedCount],
      ['Ventes partielles', data.partialCount],
      ['Ventes en attente', data.pendingCount],
      [],
      ['Synthèse mensuelle'],
      ['Mois', 'Revenus HT (FCFA)', 'Bénéfice brut (FCFA)'],
      ...data.monthlyData.map((month) => [month.month, Math.round(month.revenue), Math.round(month.profit)]),
      [],
      ['Produits vendus'],
      ['Produit', 'Unités vendues', 'Revenus HT (FCFA)', 'Bénéfice brut (FCFA)', 'Marge (%)'],
      ...data.allProducts.map((product) => [
        product.name,
        product.sold,
        Math.round(product.revenue),
        Math.round(product.profit),
        product.margin.toFixed(2),
      ]),
    ]
    const csv = rows.map((row) => row.map(protectSpreadsheetCell).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rapport-saytu-yef-${getRangeSlug(rangePreset, customStartDate, customEndDate)}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen">
      <Header title="Rapports & Analyses" subtitle="Performances de votre activité" />
      <div className="space-y-4 p-3 sm:p-4 lg:space-y-6 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] text-[#6B7682]">Ventes {rangeSentence}, règlements partiels inclus</p>
            <select
              value={rangePreset}
              onChange={(event) => setRangePreset(event.target.value as ReportsRangePreset)}
              aria-label="Période du rapport"
              className="h-10 w-full rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-xs font-semibold text-[#1A3636] sm:min-w-[220px]"
            >
              {REPORT_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {rangePreset === 'custom' && (
              <div className="grid grid-cols-1 gap-2 min-[460px]:grid-cols-2">
                <input
                  type="date"
                  value={customStartDate}
                  max={customEndDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  aria-label="Date de debut"
                  className="h-10 w-full rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-xs font-semibold text-[#1A3636]"
                />
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  aria-label="Date de fin"
                  className="h-10 w-full rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-xs font-semibold text-[#1A3636]"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:w-auto">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!data || loading}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/[0.05] disabled:opacity-50"
            >
              <Download size={14} /> Exporter CSV
            </button>
            <button
              type="button"
              onClick={() => void loadReports(true)}
              disabled={refreshing || loading}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/[0.05] disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualiser
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
            {error}
          </div>
        )}

        {isCashier && !error && (
          <div className="rounded-xl border border-[#2D7D7D]/[0.12] bg-[#F4F7FB] px-3 py-2.5 text-xs text-[#5C6B73]">
            Rapport personnel caisse : seules vos ventes et vos encaissements associes sont pris en compte ici.
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            title="Revenus hors taxe"
            value={loading ? '…' : renderResponsiveCurrency(totalRevenue)}
            change={rangeLabel}
            changeType="up"
            icon={<DollarSign size={20} />}
            color="#6C5CE7"
          />
          <MetricCard
            title="Bénéfice brut"
            value={loading ? '…' : renderResponsiveCurrency(totalProfit)}
            change={rangeLabel}
            changeType="up"
            icon={<TrendingUp size={20} />}
            color="#10b981"
          />
          <MetricCard
            title="Articles vendus"
            value={loading ? '…' : String(totalSold)}
            change={<><span className="sm:hidden">Tous</span><span className="hidden sm:inline">tous produits</span></>}
            changeType="neutral"
            icon={<BarChart3 size={20} />}
            color="#8b5cf6"
          />
          <MetricCard
            title="Marge moyenne"
            value={loading ? '…' : `${avgMargin.toFixed(1)}%`}
            change={<><span className="sm:hidden">Top ventes</span><span className="hidden sm:inline">sur top produits</span></>}
            changeType="neutral"
            icon={<Package size={20} />}
            color="#f97316"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5C6B73]">Taux d&apos;encaissement</p>
                <p className="mt-2 text-2xl font-bold text-[#1A3636]">{loading ? '...' : `${collectionRate.toFixed(0)}%`}</p>
                <p className="mt-1 text-xs text-[#6B7682]">
                  {loading ? 'Chargement...' : `${formatCurrencyCompact(totalCollected)} encaisses sur ${formatCurrencyCompact(totalInvoiced)}`}
                </p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Wallet size={18} />
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#2D7D7D]/[0.08]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, collectionRate))}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[#6B7682]">
              {loading ? '...' : `${completedCount} reglees, ${collectionFollowUpCount} a suivre`}
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5C6B73]">Dettes clients</p>
                <p className="mt-2 text-2xl font-bold text-[#1A3636]">{loading ? '...' : renderResponsiveCurrency(totalDue)}</p>
                <p className="mt-1 text-xs text-[#6B7682]">
                  {loading ? 'Chargement...' : `${partialCount} vente(s) partielle(s), ${pendingCount} en attente`}
                </p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <TriangleAlert size={18} />
              </div>
            </div>
            <p className="mt-4 text-[11px] text-[#6B7682]">
              {loading ? '...' : totalDue > 0 ? 'Encaissements clients encore ouverts sur la periode.' : 'Aucun solde client ouvert sur la periode.'}
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5C6B73]">Ticket moyen</p>
                <p className="mt-2 text-2xl font-bold text-[#1A3636]">{loading ? '...' : renderResponsiveCurrency(averageTicket)}</p>
                <p className="mt-1 text-xs text-[#6B7682]">
                  {loading ? 'Chargement...' : `${salesCount} vente(s) sur ${rangeLabel}`}
                </p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#6C5CE7]/10 text-[#6C5CE7]">
                <Receipt size={18} />
              </div>
            </div>
            <p className="mt-4 text-[11px] text-[#6B7682]">
              {loading ? '...' : salesCount > 0 ? 'Mesure utile pour ajuster panier moyen et remises.' : 'Le ticket moyen apparaitra apres vos premieres ventes.'}
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5C6B73]">Meilleure periode</p>
                <p className="mt-2 text-2xl font-bold text-[#1A3636]">{loading ? '...' : bestMonth?.month ?? 'Aucune'}</p>
                <p className="mt-1 text-xs text-[#6B7682]">
                  {loading ? 'Chargement...' : bestMonth ? `${formatCurrencyCompact(bestMonth.revenue)} de revenus HT` : 'Pas encore assez de ventes pour comparer.'}
                </p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
                <Target size={18} />
              </div>
            </div>
            <p className="mt-4 text-[11px] text-[#6B7682]">
              {loading ? '...' : bestMonth ? `${formatCurrencyCompact(bestMonth.profit)} de benefice brut sur cette periode.` : 'Le meilleur mois apparaitra automatiquement avec l historique.'}
            </p>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
          <Card className="p-4 sm:p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-[#1A3636] sm:mb-6">Revenus HT & bénéfices bruts ({rangeLabel})</h3>
            {loading ? (
              <div className="flex h-[220px] min-[420px]:h-[240px] sm:h-[250px] items-center justify-center">
                <div className="animate-pulse text-[#6B7682] text-sm">Chargement…</div>
              </div>
            ) : (
              <div className="h-[220px] min-[420px]:h-[240px] sm:h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.monthlyData ?? []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} barCategoryGap="18%" maxBarSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: '#9AA7AE', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9AA7AE', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrencyCompact(Number(value)).replace(' FCFA', '')} width={44} />
                    <Tooltip
                      contentStyle={{ background: '#F4F7FB', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [formatCurrency(Number(value)), '']}
                    />
                    <Bar dataKey="revenue" fill="#6C5CE7" radius={[6, 6, 0, 0]} name="Revenus" />
                    <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} name="Bénéfice" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#1A3636] mb-4">Top produits</h3>
            {!loading && categoryData.length > 0 ? (
              <>
                <div className="h-[220px] min-[420px]:h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#F4F7FB', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px' }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [formatCurrency(Number(value)), '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {categoryData.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                        <span className="truncate text-[#6B7682]">{cat.name}</span>
                      </div>
                      <span className="flex-shrink-0 font-medium text-[#1A3636]">{cat.percentage}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                    <p className="text-[10px] uppercase tracking-[0.07em] text-[#6B7682]">Produit rentable</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#1A3636]">
                      {bestProductByProfit?.name ?? 'Aucun produit'}
                    </p>
                    <p className="mt-1 text-xs text-emerald-600">
                      {bestProductByProfit ? formatCurrencyCompact(bestProductByProfit.profit) : 'Pas encore de benefice'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                    <p className="text-[10px] uppercase tracking-[0.07em] text-[#6B7682]">Meilleur volume</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#1A3636]">
                      {bestProductByUnits?.name ?? 'Aucun produit'}
                    </p>
                    <p className="mt-1 text-xs text-[#6C5CE7]">
                      {bestProductByUnits ? `${bestProductByUnits.sold} unite(s) vendue(s)` : 'Pas encore de volume'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[#6B7682]">
                <p className="text-xs">{loading ? 'Chargement…' : 'Aucune donnée'}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Top products table */}
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[#1A3636] mb-4">Top produits — {rangeLabel}</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="h-3 bg-[#2D7D7D]/[0.08] rounded flex-1" />
                  <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-12" />
                  <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-20" />
                  <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-20" />
                </div>
              ))}
            </div>
          ) : (data?.topProducts ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-[#6B7682]">Aucune donnée de ventes</div>
          ) : (
            <>
              <div className="space-y-2 sm:hidden">
                {(data?.topProducts ?? []).map((row, index) => (
                  <article key={row.id} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#6C5CE7]/[0.1] text-xs font-bold text-[#6C5CE7]">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#1A3636]">{row.name}</p>
                        <p className="mt-0.5 text-xs text-[#6B7682]">{row.sold} unité(s) vendue(s)</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-semibold ${row.margin > 40 ? 'text-emerald-600' : row.margin > 25 ? 'text-[#6C5CE7]' : 'text-amber-600'}`}>
                        {row.margin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#2D7D7D]/[0.07] pt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[#6B7682]">Revenus</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#1A3636]">{formatCurrencyCompact(row.revenue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-[#6B7682]">Bénéfice</p>
                        <p className="mt-0.5 text-sm font-semibold text-emerald-600">{formatCurrencyCompact(row.profit)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2D7D7D]/[0.08]">
                    <th className="text-left pb-3 text-xs font-medium text-[#6B7682] uppercase tracking-wider">Produit</th>
                    <th className="text-right pb-3 text-xs font-medium text-[#6B7682] uppercase tracking-wider">Vendus</th>
                    <th className="text-right pb-3 text-xs font-medium text-[#6B7682] uppercase tracking-wider">Revenus</th>
                    <th className="text-right pb-3 text-xs font-medium text-[#6B7682] uppercase tracking-wider">Bénéfice</th>
                    <th className="text-right pb-3 text-xs font-medium text-[#6B7682] uppercase tracking-wider">Marge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {(data?.topProducts ?? []).map((row) => (
                    <tr key={row.id} className="hover:bg-[#F4F7FB] transition-colors">
                      <td className="py-3 text-sm text-[#1A3636] font-medium">{row.name}</td>
                      <td className="py-3 text-sm text-[#6B7682] text-right">{row.sold}</td>
                      <td className="py-3 text-sm text-[#1A3636] text-right font-medium">{formatCurrency(row.revenue)}</td>
                      <td className="py-3 text-sm text-emerald-600 text-right">{formatCurrency(row.profit)}</td>
                      <td className="py-3 text-sm text-right">
                        <span className={`font-medium ${row.margin > 40 ? 'text-emerald-600' : row.margin > 25 ? 'text-[#6C5CE7]' : 'text-amber-600'}`}>
                          {row.margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-5">
          <Card className="p-4 sm:p-5 xl:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#1A3636]">Modes de paiement</h3>
                <p className="mt-1 text-xs text-[#6B7682]">Encaissements et restes par canal</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6C5CE7]/10 text-[#6C5CE7]">
                <CreditCard size={18} />
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="animate-pulse space-y-2 rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                    <div className="h-3 w-28 rounded bg-[#2D7D7D]/[0.08]" />
                    <div className="h-2 w-full rounded bg-[#2D7D7D]/[0.08]" />
                  </div>
                ))}
              </div>
            ) : paymentMethods.every((method) => method.count === 0 && method.invoiced === 0) ? (
              <div className="flex h-[220px] items-center justify-center text-center text-sm text-[#6B7682]">
                Aucun paiement enregistre sur cette periode.
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method) => {
                  const meta = PAYMENT_METHOD_META[method.method]
                  const Icon = meta.icon
                  const fill = method.invoiced > 0 ? Math.max(0, Math.min(100, (method.collected / method.invoiced) * 100)) : 0

                  return (
                    <article key={method.method} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}>
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#1A3636]">{meta.label}</p>
                            <p className="mt-0.5 text-xs text-[#6B7682]">{method.count} vente(s)</p>
                          </div>
                        </div>
                        <span className="flex-shrink-0 text-xs font-semibold text-[#1A3636]">{fill.toFixed(0)}%</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#2D7D7D]/[0.08]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${fill}%`, backgroundColor: meta.color }} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-[#6B7682]">Facture</p>
                          <p className="mt-0.5 font-semibold text-[#1A3636]">{formatCurrencyCompact(method.invoiced)}</p>
                        </div>
                        <div>
                          <p className="text-[#6B7682]">Encaisse</p>
                          <p className="mt-0.5 font-semibold text-emerald-600">{formatCurrencyCompact(method.collected)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#6B7682]">Reste</p>
                          <p className="mt-0.5 font-semibold text-amber-600">{formatCurrencyCompact(method.due)}</p>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-5 xl:col-span-3">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#1A3636]">Top clients & dettes</h3>
                <p className="mt-1 text-xs text-[#6B7682]">Qui achete le plus, et qui reste a relancer</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Users size={18} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
              <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                <p className="text-[10px] uppercase tracking-[0.07em] text-[#6B7682]">Meilleur client</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#1A3636]">{bestClientByRevenue?.name ?? 'Aucun client'}</p>
                <p className="mt-1 text-xs text-emerald-600">{bestClientByRevenue ? formatCurrencyCompact(bestClientByRevenue.invoiced) : 'Pas encore de chiffre'}</p>
                <p className="mt-1 text-xs text-[#6B7682]">{bestClientByRevenue ? `${bestClientByRevenue.salesCount} vente(s)` : 'Aucune vente client sur la periode'}</p>
              </div>
              <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                <p className="text-[10px] uppercase tracking-[0.07em] text-[#6B7682]">Dette la plus forte</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#1A3636]">{highestDueClient?.name ?? 'Aucun client'}</p>
                <p className="mt-1 text-xs text-amber-600">{highestDueClient ? formatCurrencyCompact(highestDueClient.due) : 'Aucun reste client'}</p>
                <p className="mt-1 text-xs text-[#6B7682]">{highestDueClient && highestDueClient.due > 0 ? `${highestDueClient.collectionRate.toFixed(0)}% deja encaisse` : 'Aucun suivi ouvert actuellement'}</p>
              </div>
            </div>

            {loading ? (
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="animate-pulse rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                    <div className="h-3 w-32 rounded bg-[#2D7D7D]/[0.08]" />
                    <div className="mt-3 h-2 w-full rounded bg-[#2D7D7D]/[0.08]" />
                  </div>
                ))}
              </div>
            ) : topClients.length === 0 ? (
              <div className="mt-4 flex h-[220px] items-center justify-center text-center text-sm text-[#6B7682]">
                Aucun client remonte sur cette periode.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {topClients.map((client) => (
                  <article key={client.key} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[#1A3636]">{client.name}</p>
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#6B7682]">{client.salesCount} vente(s)</span>
                        </div>
                        <p className="mt-1 text-xs text-[#6B7682]">{client.phone || 'Telephone non renseigne'}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-semibold text-[#1A3636]">{formatCurrencyCompact(client.invoiced)}</p>
                        <p className="mt-1 text-xs text-[#6B7682]">{client.collectionRate.toFixed(0)}% encaisses</p>
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#2D7D7D]/[0.08]">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, client.collectionRate))}%` }} />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-[#6B7682]">Facture</p>
                        <p className="mt-0.5 font-semibold text-[#1A3636]">{formatCurrencyCompact(client.invoiced)}</p>
                      </div>
                      <div>
                        <p className="text-[#6B7682]">Encaisse</p>
                        <p className="mt-0.5 font-semibold text-emerald-600">{formatCurrencyCompact(client.collected)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#6B7682]">Reste</p>
                        <p className="mt-0.5 font-semibold text-amber-600">{formatCurrencyCompact(client.due)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
