'use client'
import { useCallback, useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, MetricCard } from '@/components/ui/Card'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { TrendingUp, Package, DollarSign, BarChart3, Download, RefreshCw, Wallet, Receipt, TriangleAlert, Target } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { getReportsData, type ReportsRangeInput, type ReportsRangePreset } from '@/lib/supabase/queries'

const COLORS = ['#6C5CE7', '#8b5cf6', '#f97316', '#10b981', '#0ea5e9', '#94a3b8']
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
}

export default function ReportsPage() {
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
      </div>
    </div>
  )
}
