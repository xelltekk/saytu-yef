'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface TopProduct {
  product_name: string
  sold: number
  revenue: number
}

interface SaleItemSummary {
  product_name: string
  quantity: number
  total: number
}

interface SaleWithItems {
  total: number
  tax: number
  items: SaleItemSummary[] | null
}

export function TopProducts({ refreshKey = 0 }: { refreshKey?: number }) {
  const [products, setProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadTopProducts = async () => {
      const supabase = createClient()
      const start = new Date()
      start.setMonth(start.getMonth() - 1)

      const { data, error } = await supabase
        .from('sales')
        .select('total, tax, items:sale_items(product_name, quantity, total)')
        .gte('created_at', start.toISOString())
        .in('payment_status', ['completed', 'partial', 'pending'])

      if (!active) return

      if (error) {
        console.error(error)
        setProducts([])
        setLoading(false)
        return
      }

        const map: Record<string, TopProduct> = {}
        ;((data ?? []) as SaleWithItems[]).forEach((sale) => {
          const grossItemsTotal = sale.items?.reduce((sum, item) => sum + Number(item.total), 0) ?? 0
          const netRevenue = Math.max(0, Number(sale.total) - Number(sale.tax ?? 0))
          const revenueFactor = grossItemsTotal > 0 ? netRevenue / grossItemsTotal : 1

          sale.items?.forEach((item) => {
            if (!map[item.product_name]) {
              map[item.product_name] = { product_name: item.product_name, sold: 0, revenue: 0 }
            }
            map[item.product_name].sold += item.quantity
            map[item.product_name].revenue += Number(item.total) * revenueFactor
          })
        })

        const sorted = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
        setProducts(sorted)
        setLoading(false)
    }

    void loadTopProducts()

    return () => {
      active = false
    }
  }, [refreshKey])

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#1A3636]">Top Produits</h3>
        <TrendingUp size={16} className="text-[#2D7D7D]" />
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-6 h-6 rounded-lg bg-[#2D7D7D]/[0.08]" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-28" />
                <div className="h-2 bg-[#F4F7FB] rounded w-16" />
              </div>
              <div className="h-3 bg-[#2D7D7D]/[0.08] rounded w-16" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-[#6B7682]">
          <Package size={24} className="mb-2 opacity-40" />
          <p className="text-xs">Aucune vente ce mois</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((product, i) => (
            <div key={product.product_name} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-[#2D7D7D]/[0.08] flex items-center justify-center text-xs text-[#2D7D7D] font-semibold flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1A3636] font-medium truncate">{product.product_name}</p>
                <p className="text-xs text-[#6B7682]">{product.sold} vendus</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-[#1A3636] font-semibold">{formatCurrency(product.revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
