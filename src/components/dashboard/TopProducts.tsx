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

export function TopProducts() {
  const [products, setProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const start = new Date()
    start.setMonth(start.getMonth() - 1)

    supabase
      .from('sale_items')
      .select('product_name, quantity, total, sale:sales!inner(created_at, payment_status)')
      .gte('sale.created_at', start.toISOString())
      .then(({ data }) => {
        const map: Record<string, TopProduct> = {}
        ;(data ?? []).forEach((item: { product_name: string; quantity: number; total: number }) => {
          if (!map[item.product_name]) map[item.product_name] = { product_name: item.product_name, sold: 0, revenue: 0 }
          map[item.product_name].sold += item.quantity
          map[item.product_name].revenue += Number(item.total)
        })
        const sorted = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
        setProducts(sorted)
        setLoading(false)
      })
  }, [])

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#f0f2f8]">Top Produits</h3>
        <TrendingUp size={16} className="text-[#8892aa]" />
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-6 h-6 rounded-lg bg-white/[0.06]" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-white/[0.06] rounded w-28" />
                <div className="h-2 bg-white/[0.04] rounded w-16" />
              </div>
              <div className="h-3 bg-white/[0.06] rounded w-16" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-[#8892aa]">
          <Package size={24} className="mb-2 opacity-30" />
          <p className="text-xs">Aucune vente ce mois</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((product, i) => (
            <div key={product.product_name} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] flex items-center justify-center text-xs text-[#8892aa] font-medium flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#f0f2f8] font-medium truncate">{product.product_name}</p>
                <p className="text-xs text-[#8892aa]">{product.sold} vendus</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-[#f0f2f8] font-medium">{formatCurrency(product.revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
