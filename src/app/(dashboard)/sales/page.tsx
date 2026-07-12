'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { CashSessionPanel } from '@/components/sales/CashSessionPanel'
import { POSInterface } from '@/components/sales/POSInterface'
import { PaymentModal } from '@/components/sales/PaymentModal'
import { SaleDetailModal } from '@/components/sales/SaleDetailModal'
import { Badge } from '@/components/ui/Badge'
import { printSalesSummary } from '@/lib/receipt'
import { formatCurrency, formatDate } from '@/lib/utils'
import { AlertCircle, ArrowRight, CheckCircle2, Download, Printer, ShoppingCart, Clock, RefreshCw, Search } from 'lucide-react'
import { closeCashSession, getCashSessionContext, getSales, openCashSession } from '@/lib/supabase/queries'
import { getSaleAmountDue, getSaleAmountPaid, getSaleComputedStatus, SALE_METHOD_LABELS, SALE_METHOD_VARIANTS, SALE_STATUS_LABELS, SALE_STATUS_VARIANTS } from '@/lib/sales'
import { useAccountRole } from '@/hooks/useAccountRole'
import { useUser } from '@/hooks/useUser'
import type { CashSession, Sale } from '@/types'

type Tab = 'pos' | 'history'
type HistoryFilter = 'all' | 'open' | 'paid'
type HistoryPeriod = 'all' | 'today' | '7d' | '30d'
type PaymentMethodId = 'cash' | 'wave' | 'orange_money' | 'card'
const SALES_PAGE_SIZE = 50
const CASH_SUMMARY_METHODS: Array<{ id: PaymentMethodId; label: string }> = [
  { id: 'cash', label: 'Especes' },
  { id: 'wave', label: 'Wave' },
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'card', label: 'Carte' },
]
const HISTORY_FILTER_OPTIONS: Array<{ value: HistoryFilter; label: string; shortLabel: string }> = [
  { value: 'all', label: 'Toutes les ventes', shortLabel: 'Toutes' },
  { value: 'open', label: 'Dettes ouvertes', shortLabel: 'Dettes' },
  { value: 'paid', label: 'Ventes soldees', shortLabel: 'Soldees' },
]
const HISTORY_PERIOD_OPTIONS: Array<{ value: HistoryPeriod; label: string; shortLabel: string }> = [
  { value: 'all', label: 'Toute periode chargee', shortLabel: 'Periode' },
  { value: 'today', label: 'Aujourd hui', shortLabel: 'Jour' },
  { value: '7d', label: '7 derniers jours', shortLabel: '7 jours' },
  { value: '30d', label: '30 derniers jours', shortLabel: '30 jours' },
]

export default function SalesPage() {
  const { isCashier } = useAccountRole()
  const { businessName, businessAddress, businessPhone, businessNinea, displayName } = useUser()
  const [tab, setTab] = useState<Tab>('pos')
  const [showPayment, setShowPayment] = useState(false)
  const [sales, setSales] = useState<Sale[]>([])
  const [loadingSales, setLoadingSales] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreSales, setHasMoreSales] = useState(true)
  const [salesError, setSalesError] = useState('')
  const [salesNotice, setSalesNotice] = useState('')
  const [salesQuery, setSalesQuery] = useState('')
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('all')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [posRefreshKey, setPosRefreshKey] = useState(0)
  const [cashSessionLoading, setCashSessionLoading] = useState(true)
  const [cashSessionError, setCashSessionError] = useState('')
  const [activeCashSession, setActiveCashSession] = useState<CashSession | null>(null)
  const [cashSessionHistory, setCashSessionHistory] = useState<CashSession[]>([])

  const loadSales = useCallback(async (offset = 0) => {
    const loadingNextPage = offset > 0
    if (loadingNextPage) setLoadingMore(true)
    else setLoadingSales(true)
    setSalesError('')

    try {
      const nextSales = await getSales(SALES_PAGE_SIZE, offset)
      if (loadingNextPage) {
        setSales((current) => {
          const merged = new Map(current.map((sale) => [sale.id, sale]))
          nextSales.forEach((sale) => merged.set(sale.id, sale))
          return Array.from(merged.values())
        })
      } else {
        setSales(nextSales)
      }
      setHasMoreSales(nextSales.length === SALES_PAGE_SIZE)
    } catch (error: unknown) {
      console.error(error)
      setSalesError(
        error instanceof Error
          ? error.message
          : "Impossible de charger l'historique des ventes."
      )
    } finally {
      if (loadingNextPage) setLoadingMore(false)
      else setLoadingSales(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'history') void loadSales()
  }, [tab, loadSales])

  const loadCashSessions = useCallback(async () => {
    setCashSessionLoading(true)
    setCashSessionError('')

    try {
      const context = await getCashSessionContext()
      setActiveCashSession(context.activeSession)
      setCashSessionHistory(context.history)
    } catch (error: unknown) {
      console.error(error)
      setCashSessionError(
        error instanceof Error
          ? error.message
          : "Impossible de charger l'etat de la caisse."
      )
      setActiveCashSession(null)
      setCashSessionHistory([])
    } finally {
      setCashSessionLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCashSessions()
  }, [loadCashSessions])

  useEffect(() => {
    if (!salesNotice) return
    const timeout = window.setTimeout(() => setSalesNotice(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [salesNotice])

  const debtCount = useMemo(
    () => sales.filter((sale) => {
      const status = getSaleComputedStatus(sale)
      return getSaleAmountDue(sale) > 0 && status !== 'cancelled' && status !== 'refunded'
    }).length,
    [sales]
  )

  const outstandingAmount = useMemo(
    () => sales.reduce((sum, sale) => {
      const status = getSaleComputedStatus(sale)
      if (status === 'cancelled' || status === 'refunded') return sum
      return sum + getSaleAmountDue(sale)
    }, 0),
    [sales]
  )

  const filteredSales = useMemo(() => {
    const query = salesQuery.trim().toLocaleLowerCase('fr')

    return sales.filter((sale) => {
      const computedStatus = getSaleComputedStatus(sale)
      const isOpen = getSaleAmountDue(sale) > 0
        && computedStatus !== 'cancelled'
        && computedStatus !== 'refunded'

      const saleDate = new Date(sale.created_at)
      const now = new Date()
      const matchesPeriod = historyPeriod === 'all'
        || (historyPeriod === 'today'
          && saleDate.getFullYear() === now.getFullYear()
          && saleDate.getMonth() === now.getMonth()
          && saleDate.getDate() === now.getDate())
        || (historyPeriod === '7d' && saleDate.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000)
        || (historyPeriod === '30d' && saleDate.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000)

      if (!matchesPeriod) return false
      if (historyFilter === 'open' && !isOpen) return false
      if (historyFilter === 'paid' && (isOpen || computedStatus !== 'completed')) return false
      if (!query) return true

      const searchableText = [
        sale.customer_name,
        sale.customer_phone,
        ...(sale.items ?? []).map((item) => item.product_name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fr')

      return searchableText.includes(query)
    })
  }, [historyFilter, historyPeriod, sales, salesQuery])

  const historySummary = useMemo(() => {
    const methodTotals: Record<PaymentMethodId, { count: number; amount: number }> = {
      cash: { count: 0, amount: 0 },
      wave: { count: 0, amount: 0 },
      orange_money: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
    }

    let totalItems = 0
    let totalInvoiced = 0
    let totalCollected = 0
    let totalDue = 0
    let openDebtCount = 0
    let completedCount = 0

    filteredSales.forEach((sale) => {
      const saleStatus = getSaleComputedStatus(sale)
      const amountPaid = getSaleAmountPaid(sale)
      const amountDue = getSaleAmountDue(sale)

      totalItems += (sale.items ?? []).reduce((sum, item) => sum + item.quantity, 0)
      totalInvoiced += sale.total
      totalCollected += amountPaid
      totalDue += amountDue

      if (amountDue > 0 && saleStatus !== 'cancelled' && saleStatus !== 'refunded') {
        openDebtCount += 1
      }

      if (saleStatus === 'completed') {
        completedCount += 1
      }

      if (sale.payments?.length) {
        sale.payments.forEach((payment) => {
          const method = payment.payment_method as PaymentMethodId
          if (!methodTotals[method]) return
          methodTotals[method].count += 1
          methodTotals[method].amount += payment.amount
        })
        return
      }

      if (amountPaid > 0) {
        methodTotals[sale.payment_method].count += 1
        methodTotals[sale.payment_method].amount += amountPaid
      }
    })

    return {
      salesCount: filteredSales.length,
      totalItems,
      totalInvoiced,
      totalCollected,
      totalDue,
      openDebtCount,
      completedCount,
      averageTicket: filteredSales.length > 0 ? totalInvoiced / filteredSales.length : 0,
      paymentBreakdown: CASH_SUMMARY_METHODS
        .map((method) => ({
          id: method.id,
          label: method.label,
          count: methodTotals[method.id].count,
          amount: methodTotals[method.id].amount,
        }))
        .filter((method) => method.count > 0 || method.amount > 0)
        .sort((left, right) => right.amount - left.amount || right.count - left.count),
    }
  }, [filteredSales])

  const historyPeriodLabel = useMemo(() => (
    HISTORY_PERIOD_OPTIONS.find((option) => option.value === historyPeriod)?.label ?? 'Toute periode chargee'
  ), [historyPeriod])

  const historySummaryTitle = historyPeriod === 'today'
    ? (isCashier ? 'Ma cloture du jour' : 'Cloture de caisse du jour')
    : historyPeriod === '7d'
      ? (isCashier ? 'Ma synthese des 7 derniers jours' : 'Synthese caisse - 7 derniers jours')
      : historyPeriod === '30d'
        ? (isCashier ? 'Ma synthese des 30 derniers jours' : 'Synthese caisse - 30 derniers jours')
        : (isCashier ? 'Ma synthese caisse' : 'Synthese caisse')

  const historySummarySubtitle = useMemo(() => {
    const filterLabel = historyFilter === 'all'
      ? 'toutes les ventes'
      : historyFilter === 'open'
        ? 'les dettes ouvertes'
        : 'les ventes soldees'

    const searchLabel = salesQuery.trim()
      ? `, recherche "${salesQuery.trim()}"`
      : ''

    return `${historyPeriodLabel} - ${filterLabel}${searchLabel}`
  }, [historyFilter, historyPeriodLabel, salesQuery])

  const hasActiveHistoryFilters = salesQuery.trim().length > 0
    || historyFilter !== 'all'
    || historyPeriod !== 'all'

  const resetHistoryFilters = () => {
    setSalesQuery('')
    setHistoryFilter('all')
    setHistoryPeriod('all')
  }

  const handleSaleSaved = useCallback((message?: string) => {
    setSalesNotice(message ?? 'La vente a bien été mise à jour.')
    void loadSales(0)
    void loadCashSessions()
  }, [loadCashSessions, loadSales])

  const handleOpenCashSession = useCallback(async (openingAmount: number, note?: string) => {
    await openCashSession(openingAmount, note)
    await loadCashSessions()
  }, [loadCashSessions])

  const handleCloseCashSession = useCallback(async (closingAmount: number, note?: string) => {
    if (!activeCashSession?.id) {
      throw new Error("Aucune caisse ouverte à clôturer.")
    }

    await closeCashSession(activeCashSession.id, closingAmount, note)
    await loadCashSessions()
  }, [activeCashSession, loadCashSessions])

  const exportSalesCsv = () => {
    if (filteredSales.length === 0) return

    const protectSpreadsheetCell = (value: string | number) => {
      const text = String(value)
      const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safeText.replace(/"/g, '""')}"`
    }
    const rows: Array<Array<string | number>> = [
      ['Date', 'Client', 'Téléphone', 'Produits', 'Total (FCFA)', 'Versé (FCFA)', 'Reste (FCFA)', 'Statut', 'Paiement'],
      ...filteredSales.map((sale) => {
        const status = getSaleComputedStatus(sale)
        return [
          new Date(sale.created_at).toLocaleString('fr-SN'),
          sale.customer_name || 'Client',
          sale.customer_phone || '',
          (sale.items ?? []).map((item) => `${item.product_name} x${item.quantity}`).join(' | '),
          sale.total,
          getSaleAmountPaid(sale),
          getSaleAmountDue(sale),
          SALE_STATUS_LABELS[status],
          SALE_METHOD_LABELS[sale.payment_method],
        ]
      }),
    ]
    const csv = rows.map((row) => row.map(protectSpreadsheetCell).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ventes-saytu-yef-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportHistorySummaryCsv = () => {
    if (filteredSales.length === 0) return

    const protectSpreadsheetCell = (value: string | number) => {
      const text = String(value)
      const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safeText.replace(/"/g, '""')}"`
    }

    const rows: Array<Array<string | number>> = [
      ['Synthese caisse', historySummaryTitle],
      ['Periode', historySummarySubtitle],
      ['Boutique', businessName || 'Saytu Yef'],
      ['Responsable', isCashier ? displayName : 'Equipe vente'],
      [],
      ['Ventes', historySummary.salesCount],
      ['Articles', historySummary.totalItems],
      ['Montant facture (FCFA)', Math.round(historySummary.totalInvoiced)],
      ['Montant encaisse (FCFA)', Math.round(historySummary.totalCollected)],
      ['Reste a encaisser (FCFA)', Math.round(historySummary.totalDue)],
      ['Dettes ouvertes', historySummary.openDebtCount],
      ['Ticket moyen (FCFA)', Math.round(historySummary.averageTicket)],
      [],
      ['Encaissements par methode'],
      ['Methode', 'Nombre', 'Montant encaisse (FCFA)'],
      ...historySummary.paymentBreakdown.map((method) => [
        method.label,
        method.count,
        Math.round(method.amount),
      ]),
    ]

    const csv = rows.map((row) => row.map(protectSpreadsheetCell).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cloture-caisse-${historyPeriod}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintHistorySummary = () => {
    if (filteredSales.length === 0) return

    printSalesSummary({
      businessName: businessName || 'Saytu Yef',
      businessAddress: businessAddress || undefined,
      businessPhone: businessPhone || undefined,
      businessNinea: businessNinea || undefined,
      title: historySummaryTitle,
      subtitle: historySummarySubtitle,
      generatedAt: new Date().toLocaleString('fr-SN'),
      operatorLabel: isCashier ? displayName : 'Equipe vente',
      salesCount: historySummary.salesCount,
      totalItems: historySummary.totalItems,
      totalInvoiced: historySummary.totalInvoiced,
      totalCollected: historySummary.totalCollected,
      totalDue: historySummary.totalDue,
      averageTicket: historySummary.averageTicket,
      openDebtCount: historySummary.openDebtCount,
      methods: historySummary.paymentBreakdown,
    })
  }

  const checkoutDisabledReason = useMemo(() => {
    if (cashSessionLoading) return 'Vérification de la caisse en cours...'
    if (cashSessionError) return cashSessionError
    if (!activeCashSession) {
      return "Ouvrez d'abord votre caisse avec un fond initial avant d'encaisser."
    }
    return ''
  }, [activeCashSession, cashSessionError, cashSessionLoading])

  const canCheckout = !cashSessionLoading && !cashSessionError && !!activeCashSession

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="Ventes" subtitle="Point de vente & historique" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <CashSessionPanel
          activeSession={activeCashSession}
          history={cashSessionHistory}
          loading={cashSessionLoading}
          error={cashSessionError}
          isCashier={isCashier}
          onRefresh={() => void loadCashSessions()}
          onOpenSession={handleOpenCashSession}
          onCloseSession={handleCloseCashSession}
        />

        <div className="grid w-full max-w-md grid-cols-2 gap-1 rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-1">
          <button
            onClick={() => setTab('pos')}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === 'pos' ? 'bg-[#6C5CE7] text-white' : 'text-[#6B7682] hover:text-[#1A3636]'}`}
          >
            <ShoppingCart size={15} /> Caisse
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === 'history' ? 'bg-[#6C5CE7] text-white' : 'text-[#6B7682] hover:text-[#1A3636]'}`}
          >
            <Clock size={15} /> Historique
          </button>
        </div>

        {tab === 'pos' ? (
          <POSInterface
            onCheckout={() => setShowPayment(true)}
            refreshKey={posRefreshKey}
            canCheckout={canCheckout}
            checkoutDisabledReason={checkoutDisabledReason}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-2 gap-3 sm:w-auto">
                <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Dettes ouvertes</p>
                  <p className="mt-1 text-lg font-bold text-[#1A3636]">{debtCount}</p>
                  <p className="text-[10px] text-[#6B7682]">ventes chargées</p>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700">Reste a encaisser</p>
                  <p className="mt-1 text-lg font-bold text-amber-700">{formatCurrency(outstandingAmount)}</p>
                  <p className="text-[10px] text-amber-700/70">ventes chargées</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={exportSalesCsv}
                  disabled={filteredSales.length === 0 || loadingSales}
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[#6B7682] transition-colors hover:bg-white hover:text-[#1A3636] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={13} /> Exporter CSV
                </button>
                <button
                  type="button"
                  onClick={() => void loadSales(0)}
                  disabled={loadingSales || loadingMore}
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[#6B7682] transition-colors hover:bg-white hover:text-[#1A3636] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw size={13} className={loadingSales ? 'animate-spin' : ''} /> Actualiser
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
              <label className="relative block">
                <span className="sr-only">Rechercher une vente</span>
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7682]"
                />
                <input
                  type="search"
                  value={salesQuery}
                  onChange={(event) => setSalesQuery(event.target.value)}
                  placeholder="Client, téléphone ou produit…"
                  className="h-11 w-full rounded-xl border border-[#2D7D7D]/[0.12] bg-white pl-10 pr-4 text-sm text-[#1A3636] placeholder:text-[#9AA7AE]"
                />
              </label>
              <select
                value={historyFilter}
                onChange={(event) => setHistoryFilter(event.target.value as HistoryFilter)}
                aria-label="Filtrer les ventes"
                className="hidden h-11 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-sm text-[#1A3636] sm:block"
              >
                <option value="all">Toutes les ventes</option>
                <option value="open">Dettes ouvertes</option>
                <option value="paid">Ventes soldées</option>
              </select>
              <select
                value={historyPeriod}
                onChange={(event) => setHistoryPeriod(event.target.value as HistoryPeriod)}
                aria-label="Filtrer les ventes par période"
                className="hidden h-11 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-3 text-sm text-[#1A3636] sm:block"
              >
                <option value="all">Toute période chargée</option>
                <option value="today">Aujourd’hui</option>
                <option value="7d">7 derniers jours</option>
                <option value="30d">30 derniers jours</option>
              </select>
            </div>

            <div className="space-y-2 sm:hidden">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#2D7D7D]/[0.08] bg-white px-3 py-2">
                <p className="text-xs font-medium text-[#5C6B73]">
                  {filteredSales.length} resultat(s)
                </p>
                {hasActiveHistoryFilters && (
                  <button
                    type="button"
                    onClick={resetHistoryFilters}
                    className="min-h-9 rounded-lg border border-[#2D7D7D]/[0.12] px-3 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/[0.05]"
                  >
                    Reinitialiser
                  </button>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {HISTORY_FILTER_OPTIONS.map((option) => {
                  const active = historyFilter === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={option.label}
                      onClick={() => setHistoryFilter(option.value)}
                      className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[#6C5CE7] bg-[#6C5CE7] text-white'
                          : 'border-[#2D7D7D]/[0.12] bg-white text-[#5C6B73]'
                      }`}
                    >
                      {option.shortLabel}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {HISTORY_PERIOD_OPTIONS.map((option) => {
                  const active = historyPeriod === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={option.label}
                      onClick={() => setHistoryPeriod(option.value)}
                      className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[#2D7D7D] bg-[#2D7D7D] text-white'
                          : 'border-[#2D7D7D]/[0.12] bg-white text-[#5C6B73]'
                      }`}
                    >
                      {option.shortLabel}
                    </button>
                  )
                })}
              </div>
            </div>

            {hasActiveHistoryFilters && (
              <div className="hidden sm:flex sm:justify-end">
                <button
                  type="button"
                  onClick={resetHistoryFilters}
                  className="min-h-10 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-4 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/[0.05]"
                >
                  Reinitialiser les filtres
                </button>
              </div>
            )}

            {salesNotice && (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700"
              >
                <CheckCircle2 size={18} className="shrink-0" />
                {salesNotice}
              </div>
            )}

            {!salesError && (
              <div className="rounded-[28px] border border-[#2D7D7D]/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))] p-4 shadow-[0_16px_40px_rgba(26,54,54,0.06)] sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2D7D7D]">
                      {isCashier ? 'Mode caisse personnel' : 'Pilotage caisse'}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-[#1A3636]">{historySummaryTitle}</h3>
                    <p className="mt-1 text-xs text-[#6B7682]">{historySummarySubtitle}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button
                      type="button"
                      onClick={handlePrintHistorySummary}
                      disabled={filteredSales.length === 0 || loadingSales}
                      className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-4 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Printer size={13} /> Imprimer
                    </button>
                    <button
                      type="button"
                      onClick={exportHistorySummaryCsv}
                      disabled={filteredSales.length === 0 || loadingSales}
                      className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-4 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download size={13} /> Export caisse
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Ventes</p>
                    <p className="mt-1 text-xl font-bold text-[#1A3636]">{historySummary.salesCount}</p>
                    <p className="text-[11px] text-[#6B7682]">{historySummary.totalItems} article(s)</p>
                  </div>
                  <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Encaisse</p>
                    <p className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(historySummary.totalCollected)}</p>
                    <p className="text-[11px] text-[#6B7682]">sur {formatCurrency(historySummary.totalInvoiced)}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700">Reste ouvert</p>
                    <p className="mt-1 text-xl font-bold text-amber-700">{formatCurrency(historySummary.totalDue)}</p>
                    <p className="text-[11px] text-amber-700/80">{historySummary.openDebtCount} dette(s)</p>
                  </div>
                  <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Ticket moyen</p>
                    <p className="mt-1 text-xl font-bold text-[#1A3636]">{formatCurrency(historySummary.averageTicket)}</p>
                    <p className="text-[11px] text-[#6B7682]">{historySummary.completedCount} vente(s) soldee(s)</p>
                  </div>
                  <div className="rounded-2xl border border-[#6C5CE7]/20 bg-[#6C5CE7]/10 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6C5CE7]">Vue active</p>
                    <p className="mt-1 text-base font-semibold text-[#1A3636]">{historyFilter === 'open' ? 'Dettes' : historyFilter === 'paid' ? 'Soldees' : 'Toutes'}</p>
                    <p className="text-[11px] text-[#6B7682]">{historyPeriodLabel}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 lg:grid-cols-2 2xl:grid-cols-4">
                  {CASH_SUMMARY_METHODS.map((method) => {
                    const breakdown = historySummary.paymentBreakdown.find((item) => item.id === method.id)
                    const amount = breakdown?.amount ?? 0
                    const count = breakdown?.count ?? 0

                    return (
                      <div
                        key={method.id}
                        className={`rounded-2xl border px-4 py-3 transition-colors ${
                          amount > 0
                            ? 'border-[#2D7D7D]/[0.08] bg-white'
                            : 'border-dashed border-[#2D7D7D]/[0.08] bg-white/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[#1A3636]">{method.label}</p>
                          <span className="text-[11px] text-[#6B7682]">{count} encaissement(s)</span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-[#1A3636]">{formatCurrency(amount)}</p>
                        <p className="mt-1 text-[11px] text-[#6B7682]">
                          {amount > 0 ? 'Montant deja encaisse sur la periode.' : 'Aucun reglement sur cette methode.'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {salesError && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Historique indisponible</p>
                    <p className="mt-0.5 text-xs text-red-600">{salesError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadSales()}
                  disabled={loadingSales}
                  className="min-h-10 shrink-0 rounded-xl border border-red-500/25 bg-white px-4 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  Réessayer
                </button>
              </div>
            )}

            <div
              className="overflow-hidden rounded-2xl border border-[#2D7D7D]/[0.08] bg-white"
              aria-busy={loadingSales || loadingMore}
            >
              {loadingSales && sales.length === 0 ? (
                <div className="divide-y divide-white/[0.04]">
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-32 rounded bg-[#2D7D7D]/[0.08]" />
                        <div className="h-2 w-20 rounded bg-[#F4F7FB]" />
                      </div>
                      <div className="h-4 w-20 rounded bg-[#2D7D7D]/[0.08]" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="sm:hidden">
                    {filteredSales.map((sale) => {
                      const computedStatus = getSaleComputedStatus(sale)
                      const amountDue = getSaleAmountDue(sale)
                      const amountPaid = getSaleAmountPaid(sale)
                      const paymentCount = sale.payments?.length ?? 0
                      const paymentProgress = sale.total > 0
                        ? Math.max(0, Math.min(100, Math.round((amountPaid / sale.total) * 100)))
                        : 0

                      return (
                        <button
                          key={sale.id}
                          type="button"
                          onClick={() => setSelectedSale(sale)}
                          className="w-full border-b border-[#2D7D7D]/[0.08] px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[#F4F7FB]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#1A3636]">{sale.customer_name || 'Client'}</p>
                              <p className="mt-1 text-xs text-[#6B7682]">{formatDate(sale.created_at)}</p>
                              {sale.customer_phone && (
                                <p className="mt-1 truncate text-xs text-[#6B7682]">{sale.customer_phone}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-[#1A3636]">{formatCurrency(sale.total)}</p>
                              <p className="mt-1 text-[11px] font-medium text-emerald-600">
                                Verse: {formatCurrency(amountPaid)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant={SALE_STATUS_VARIANTS[computedStatus]}>
                              {SALE_STATUS_LABELS[computedStatus]}
                            </Badge>
                            <Badge variant={SALE_METHOD_VARIANTS[sale.payment_method]}>
                              {SALE_METHOD_LABELS[sale.payment_method]}
                            </Badge>
                            {amountDue > 0 && (
                              <Badge variant="warning">Dette client</Badge>
                            )}
                            {paymentCount > 1 && (
                              <Badge variant="default">{paymentCount} versements</Badge>
                            )}
                          </div>

                          <div className="mt-3 rounded-2xl bg-[#F4F7FB] px-3 py-3">
                            <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-[#5C6B73]">
                              <span>Paye {formatCurrency(amountPaid)}</span>
                              <span>{paymentProgress}%</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                              <div
                                className={`h-full rounded-full ${amountDue > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${paymentProgress}%` }}
                              />
                            </div>
                            <div className="mt-3 flex items-end justify-between gap-3 text-xs">
                              <div className="space-y-1 text-[#6B7682]">
                                <p>{sale.items?.length ?? 0} article(s)</p>
                                <p>{paymentCount} versement(s)</p>
                              </div>
                              {amountDue > 0 ? (
                                <span className="font-medium text-amber-700">Reste: {formatCurrency(amountDue)}</span>
                              ) : (
                                <span className="font-medium text-emerald-600">Solde regle</span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-[#6C5CE7]">
                            <span>Voir detail</span>
                            <ArrowRight size={14} />
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-[420px]">
                      <thead>
                        <tr className="border-b border-[#2D7D7D]/[0.08] bg-[#F4F7FB]">
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B7682]">Client</th>
                          <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B7682] sm:table-cell">Date</th>
                          <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B7682] md:table-cell">Paiement</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#6B7682]">Montant</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B7682]">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {filteredSales.map((sale) => {
                          const computedStatus = getSaleComputedStatus(sale)
                          const amountDue = getSaleAmountDue(sale)
                          const amountPaid = getSaleAmountPaid(sale)

                          return (
                            <tr
                              key={sale.id}
                              onClick={() => setSelectedSale(sale)}
                              className="cursor-pointer transition-colors hover:bg-[#F4F7FB]"
                            >
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium text-[#1A3636]">{sale.customer_name || 'Client'}</p>
                                <p className="text-xs text-[#6B7682]">{sale.items?.length ?? 0} article(s)</p>
                                {amountDue > 0 && (
                                  <p className="mt-0.5 text-[11px] font-medium text-amber-700">
                                    Reste: {formatCurrency(amountDue)}
                                  </p>
                                )}
                              </td>
                              <td className="hidden px-4 py-3 text-xs text-[#6B7682] sm:table-cell">{formatDate(sale.created_at)}</td>
                              <td className="hidden px-4 py-3 md:table-cell">
                                <Badge variant={SALE_METHOD_VARIANTS[sale.payment_method]}>
                                  {SALE_METHOD_LABELS[sale.payment_method]}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-[#1A3636]">
                                <div>{formatCurrency(sale.total)}</div>
                                <p className="text-[11px] font-medium text-emerald-600">
                                  Verse: {formatCurrency(amountPaid)}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={SALE_STATUS_VARIANTS[computedStatus]}>
                                  {SALE_STATUS_LABELS[computedStatus]}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {!loadingSales && !salesError && filteredSales.length === 0 && (
                <div className="py-12 text-center">
                  <ShoppingCart size={32} className="mx-auto mb-3 text-[#6B7682] opacity-30" />
                  <p className="text-sm text-[#6B7682]">
                    {sales.length === 0 ? 'Aucune vente enregistrée' : 'Aucune vente ne correspond à votre recherche'}
                  </p>
                </div>
              )}
            </div>

            {!loadingSales && sales.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#6B7682]">
                  {filteredSales.length} vente(s) affichée(s) sur {sales.length} chargée(s)
                </p>
                {hasMoreSales && (
                  <button
                    type="button"
                    onClick={() => void loadSales(sales.length)}
                    disabled={loadingMore}
                    className="min-h-10 rounded-xl border border-[#2D7D7D]/[0.12] bg-white px-4 text-xs font-semibold text-[#2D7D7D] transition-colors hover:bg-[#2D7D7D]/[0.05] disabled:opacity-50"
                  >
                    {loadingMore ? 'Chargement…' : 'Charger 50 ventes de plus'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => {
          setShowPayment(false)
          setPosRefreshKey((key) => key + 1)
          void loadCashSessions()
          if (tab === 'history') void loadSales()
        }}
      />

      <SaleDetailModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onSaved={handleSaleSaved}
      />
    </div>
  )
}
