'use client'
import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { POSInterface } from '@/components/sales/POSInterface'
import { PaymentModal } from '@/components/sales/PaymentModal'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ShoppingCart, Clock, RefreshCw } from 'lucide-react'
import { getSales } from '@/lib/supabase/queries'
import type { Sale } from '@/types'

type Tab = 'pos' | 'history'

const METHOD_LABELS: Record<string, string> = { wave: 'Wave', orange_money: 'Orange Money', cash: 'Espèces', card: 'Carte' }
const METHOD_VARIANTS: Record<string, 'info' | 'warning' | 'default'> = { wave: 'info', orange_money: 'warning', cash: 'default', card: 'default' }

export default function SalesPage() {
  const [tab, setTab] = useState<Tab>('pos')
  const [showPayment, setShowPayment] = useState(false)
  const [sales, setSales] = useState<Sale[]>([])
  const [loadingSales, setLoadingSales] = useState(false)

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

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="Ventes" subtitle="Point de vente & historique" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit">
          <button
            onClick={() => setTab('pos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'pos' ? 'bg-[#4f6ef7] text-white' : 'text-[#8892aa] hover:text-[#f0f2f8]'}`}
          >
            <ShoppingCart size={15} /> Caisse
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'history' ? 'bg-[#4f6ef7] text-white' : 'text-[#8892aa] hover:text-[#f0f2f8]'}`}
          >
            <Clock size={15} /> Historique
          </button>
        </div>

        {tab === 'pos' ? (
          <POSInterface onCheckout={() => setShowPayment(true)} />
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={loadSales}
                className="flex items-center gap-1.5 text-xs text-[#8892aa] hover:text-[#f0f2f8] transition-colors"
              >
                <RefreshCw size={13} /> Actualiser
              </button>
            </div>

            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              {loadingSales ? (
                <div className="divide-y divide-white/[0.04]">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-white/[0.06] rounded w-32" />
                        <div className="h-2 bg-white/[0.04] rounded w-20" />
                      </div>
                      <div className="h-4 bg-white/[0.06] rounded w-20" />
                    </div>
                  ))}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider">Client</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider hidden sm:table-cell">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider hidden md:table-cell">Paiement</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider">Montant</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#8892aa] uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-[#f0f2f8]">{sale.customer_name || 'Client'}</p>
                          <p className="text-xs text-[#8892aa]">{sale.items?.length ?? 0} article(s)</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs text-[#8892aa]">{formatDate(sale.created_at)}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Badge variant={METHOD_VARIANTS[sale.payment_method] ?? 'default'}>
                            {METHOD_LABELS[sale.payment_method] ?? sale.payment_method}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#f0f2f8]">
                          {formatCurrency(sale.total)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={sale.payment_status === 'completed' ? 'success' : 'warning'}>
                            {sale.payment_status === 'completed' ? 'Payé' : 'En attente'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!loadingSales && sales.length === 0 && (
                <div className="text-center py-12">
                  <ShoppingCart size={32} className="text-[#8892aa] mx-auto mb-3 opacity-30" />
                  <p className="text-sm text-[#8892aa]">Aucune vente enregistrée</p>
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
          if (tab === 'history') loadSales()
        }}
      />
    </div>
  )
}
