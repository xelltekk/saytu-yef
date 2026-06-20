'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, Minus, Package, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { getStockMovements } from '@/lib/supabase/queries'
import { formatDate, formatTime } from '@/lib/utils'
import type { Product, StockMovement } from '@/types'

interface StockMovementHistoryModalProps {
  product: Product | null
  onClose: () => void
}

const movementMeta = {
  in: {
    label: 'Entrée',
    icon: Plus,
    badge: 'bg-emerald-500/10 text-emerald-700',
    iconBox: 'bg-emerald-500/10 text-emerald-700',
    sign: '+',
  },
  out: {
    label: 'Sortie',
    icon: Minus,
    badge: 'bg-amber-500/10 text-amber-700',
    iconBox: 'bg-amber-500/10 text-amber-700',
    sign: '−',
  },
  adjustment: {
    label: 'Ajustement',
    icon: SlidersHorizontal,
    badge: 'bg-[#6C5CE7]/[0.1] text-[#5A4BD4]',
    iconBox: 'bg-[#6C5CE7]/[0.1] text-[#5A4BD4]',
    sign: '',
  },
} as const

export function StockMovementHistoryModal({ product, onClose }: StockMovementHistoryModalProps) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!product) return
    setLoading(true)
    setError('')
    try {
      setMovements(await getStockMovements(product.id, product.quantity))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible de charger l'historique")
    } finally {
      setLoading(false)
    }
  }, [product])

  useEffect(() => {
    if (!product) {
      setMovements([])
      return
    }
    void load()
  }, [product, load])

  return (
    <Modal isOpen={!!product} onClose={onClose} title="Historique du stock" size="md">
      {product && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-[#F4F7FB] p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-[#6C5CE7] shadow-sm">
              <Package size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#1A3636]">{product.name}</p>
              <p className="mt-0.5 text-xs text-[#5C6B73]">Stock actuel : {product.quantity} unité(s)</p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[#5C6B73] transition-colors hover:bg-white disabled:opacity-40"
              aria-label="Actualiser l'historique"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          {error && movements.length === 0 ? null : loading && movements.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-[76px] animate-pulse rounded-2xl bg-[#F4F7FB]" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2D7D7D]/[0.14] px-4 py-10 text-center">
              <History size={28} className="mx-auto text-[#9AA7AE]" />
              <p className="mt-3 text-sm font-medium text-[#5C6B73]">Aucun mouvement enregistré</p>
              <p className="mt-1 text-xs text-[#6B7682]">Les prochaines entrées, sorties et ventes apparaîtront ici.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {movements.map((movement) => {
                const meta = movementMeta[movement.movement_type]
                const Icon = meta.icon
                const isSale = movement.reason?.startsWith('Vente ')
                return (
                  <article key={movement.id} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${meta.iconBox}`}>
                        <Icon size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${meta.badge}`}>{isSale ? 'Vente' : meta.label}</span>
                          <span className="flex-shrink-0 text-sm font-bold text-[#1A3636]">{meta.sign}{movement.quantity}</span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1 text-xs text-[#5C6B73] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <span>{movement.previous_quantity} → {movement.new_quantity} unité(s)</span>
                          <span className="flex-shrink-0">{formatDate(movement.created_at)} · {formatTime(movement.created_at)}</span>
                        </div>
                        {movement.reason && (
                          <p className="mt-2 break-words rounded-lg bg-[#F4F7FB] px-2.5 py-2 text-xs text-[#5C6B73]">
                            {isSale ? 'Vente enregistrée depuis la caisse' : movement.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {movements.length === 50 && (
            <p className="text-center text-[11px] text-[#6B7682]">Les 50 mouvements les plus récents sont affichés.</p>
          )}
        </div>
      )}
    </Modal>
  )
}
