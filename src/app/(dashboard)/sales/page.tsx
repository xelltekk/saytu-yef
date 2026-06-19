'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { POSInterface } from '@/components/sales/POSInterface'
import { PaymentModal } from '@/components/sales/PaymentModal'
import { SaleDetailModal } from '@/components/sales/SaleDetailModal'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ShoppingCart, Clock, RefreshCw } from 'lucide-react'
import { getSales } from '@/lib/supabase/queries'
import { getSaleAmountDue, getSaleAmountPaid, getSaleComputedStatus, SALE_METHOD_LABELS, SALE_METHOD_VARIANTS, SALE_STATUS_LABELS, SALE_STATUS_VARIANTS } from '@/lib/sales'
import type { Sale } from '@/types'

type Tab = 'pos' | 'history'

export default function SalesPage() {
  const [tab, setTab] = useState<Tab>('pos')
  const [showPayment, setShowPayment] = useState(false)
  const [sales, setSales] = useState<Sale[]>([])
  const [loadingSales, setLoadingSales] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [posRefreshKey, setPosRefreshKey] = useState(0)

  const loadSales = useCallback(() => {
    setLoadingSales(true)
    getSales(50)
      .then(setSales)
      .catch(console.error)
      .finally(() => setLoadingSales(false))
  }, [])

  useEffect(() => {
    if (tab === 'history') loadSales()
  }, [tab, loadSales])

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

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="Ventes" subtitle="Point de vente & historique" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex gap-1 rounded-xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] p-1 w-fit">
          <button
            onClick={() => setTab('pos')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === 'pos' ? 'bg-[#6C5CE7] text-white' : 'text-[#6B7682] hover:text-[#1A3636]'}`}
          >
            <ShoppingCart size={15} /> Caisse
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === 'history' ? 'bg-[#6C5CE7] text-white' : 'text-[#6B7682] hover:text-[#1A3636]'}`}
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
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700">Reste a encaisser</p>
                  <p className="mt-1 text-lg font-bold text-amber-700">{formatCurrency(outstandingAmount)}</p>
                </div>
              </div>

              <button
                onClick={loadSales}
                className="flex items-center gap-1.5 text-xs text-[#6B7682] transition-colors hover:text-[#1A3636]"
              >
                <RefreshCw size={13} /> Actualiser
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#2D7D7D]/[0.08]">
              {loadingSales ? (
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
                <div className="overflow-x-auto">
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
                      {sales.map((sale) => {
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
              )}

              {!loadingSales && sales.length === 0 && (
                <div className="py-12 text-center">
                  <ShoppingCart size={32} className="mx-auto mb-3 text-[#6B7682] opacity-30" />
                  <p className="text-sm text-[#6B7682]">Aucune vente enregistree</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => {
          setShowPayment(false)
          setPosRefreshKey((key) => key + 1)
          if (tab === 'history') loadSales()
        }}
      />

      <SaleDetailModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onSaved={loadSales}
      />
    </div>
  )
}
