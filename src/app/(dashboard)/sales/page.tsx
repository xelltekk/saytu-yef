'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { POSInterface } from '@/components/sales/POSInterface'
import { PaymentModal } from '@/components/sales/PaymentModal'
import { SaleDetailModal } from '@/components/sales/SaleDetailModal'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Download, ShoppingCart, Clock, RefreshCw, Search } from 'lucide-react'
import { getSales } from '@/lib/supabase/queries'
import { getSaleAmountDue, getSaleAmountPaid, getSaleComputedStatus, SALE_METHOD_LABELS, SALE_METHOD_VARIANTS, SALE_STATUS_LABELS, SALE_STATUS_VARIANTS } from '@/lib/sales'
import type { Sale } from '@/types'

type Tab = 'pos' | 'history'
type HistoryFilter = 'all' | 'open' | 'paid'
type HistoryPeriod = 'all' | 'today' | '7d' | '30d'
const SALES_PAGE_SIZE = 50
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
  }, [loadSales])

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

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="Ventes" subtitle="Point de vente & historique" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
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
          <POSInterface onCheckout={() => setShowPayment(true)} refreshKey={posRefreshKey} />
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
