import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatTime } from '@/lib/utils'
import { ShoppingBag } from 'lucide-react'
import { getSaleComputedStatus, SALE_STATUS_LABELS, SALE_STATUS_VARIANTS } from '@/lib/sales'
import type { Sale } from '@/types'

const methodColors: Record<string, 'info' | 'warning' | 'default'> = {
  wave: 'info',
  orange_money: 'warning',
  cash: 'default',
  card: 'default',
}

const methodLabels: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  cash: 'Espèces',
  card: 'Carte',
}

interface RecentActivityProps {
  sales?: Sale[]
  loading?: boolean
}

export function RecentActivity({ sales, loading }: RecentActivityProps) {
  return (
    <Card className="col-span-full lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#1A3636]">Activité Récente</h3>
        <a href="/sales" className="text-xs font-medium text-[#6C5CE7] hover:text-[#5A4BD4] transition-colors">Voir tout</a>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-[#2D7D7D]/[0.08]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-32" />
                <div className="h-2 bg-[#F4F7FB] rounded w-20" />
              </div>
              <div className="h-4 bg-[#2D7D7D]/[0.08] rounded w-24" />
            </div>
          ))}
        </div>
      ) : !sales || sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-[#6B7682]">
          <ShoppingBag size={28} className="mb-2 opacity-40" />
          <p className="text-sm">Aucune vente pour le moment</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sales.map((sale) => {
            const computedStatus = getSaleComputedStatus(sale)

            return (
              <div key={sale.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#2D7D7D]/[0.04] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#2D7D7D]/[0.1] flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={16} className="text-[#2D7D7D]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[#1A3636] font-medium truncate">
                      {sale.customer_name || 'Client'}
                    </p>
                    <Badge variant={methodColors[sale.payment_method] ?? 'default'}>
                      {methodLabels[sale.payment_method] ?? sale.payment_method}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#6B7682]">
                    {sale.items?.length ?? 0} article(s) · {formatTime(sale.created_at)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-[#1A3636]">{formatCurrency(sale.total)}</p>
                  <Badge variant={SALE_STATUS_VARIANTS[computedStatus]}>
                    {SALE_STATUS_LABELS[computedStatus]}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
