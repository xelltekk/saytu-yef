'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { AlertTriangle, Package } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface LowStockItem {
  id: string
  name: string
  quantity: number
  min_quantity: number
  category: { name: string } | null
}

export function LowStockAlert() {
  const [items, setItems] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('products')
      .select('id, name, quantity, min_quantity, category:categories(name)')
      .lte('quantity', 5)
      .eq('status', 'active')
      .order('quantity')
      .limit(5)
      .then(({ data }) => {
        setItems((data ?? []) as unknown as LowStockItem[])
        setLoading(false)
      })
  }, [])

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10">
            <AlertTriangle size={14} className="text-amber-400" />
          </div>
          <h3 className="text-sm font-semibold text-[#f0f2f8]">Stock Faible</h3>
        </div>
        {!loading && (
          <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
            {items.length} article(s)
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-white/[0.06] rounded w-28" />
                <div className="h-2 bg-white/[0.04] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-[#8892aa]">
          <Package size={24} className="mb-2 opacity-30" />
          <p className="text-xs">Tout le stock est suffisant</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                <Package size={14} className="text-[#8892aa]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#f0f2f8] font-medium truncate">{item.name}</p>
                <p className="text-[10px] text-[#8892aa]">{item.category?.name ?? '—'}</p>
              </div>
              <div className={`text-xs font-bold px-2 py-0.5 rounded-md ${item.quantity === 0 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {item.quantity === 0 ? 'Épuisé' : `Qté: ${item.quantity}`}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/inventory" className="block mt-3 text-center text-xs text-[#4f6ef7] hover:text-[#3d5ce5] transition-colors">
        Gérer le stock →
      </Link>
    </Card>
  )
}
