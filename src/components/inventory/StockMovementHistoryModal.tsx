'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { History, Minus, Package, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { getStockMovements } from '@/lib/supabase/queries'
import { formatDate, formatTime, getProductVariantSummary } from '@/lib/utils'
import type { Product, StockMovement } from '@/types'

interface StockMovementHistoryModalProps {
  product: Product | null
  onClose: () => void
}

type MovementFilter = 'all' | 'sales' | 'in' | 'out' | 'adjustment'

const movementMeta = {
  in: {
    label: 'Entree',
    icon: Plus,
    badge: 'bg-emerald-500/10 text-emerald-700',
    iconBox: 'bg-emerald-500/10 text-emerald-700',
  },
  out: {
    label: 'Sortie',
    icon: Minus,
    badge: 'bg-amber-500/10 text-amber-700',
    iconBox: 'bg-amber-500/10 text-amber-700',
  },
  adjustment: {
    label: 'Comptage',
    icon: SlidersHorizontal,
    badge: 'bg-[#6C5CE7]/[0.1] text-[#5A4BD4]',
    iconBox: 'bg-[#6C5CE7]/[0.1] text-[#5A4BD4]',
  },
} as const

function getMovementDelta(movement: StockMovement) {
  if (movement.movement_type === 'adjustment') {
    return Number(movement.new_quantity ?? 0) - Number(movement.previous_quantity ?? 0)
  }

  return movement.movement_type === 'in'
    ? Number(movement.quantity)
    : -Number(movement.quantity)
}

export function StockMovementHistoryModal({ product, onClose }: StockMovementHistoryModalProps) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<MovementFilter>('all')

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
      setFilter('all')
      return
    }
    void load()
  }, [product, load])

  const movementSummary = useMemo(() => (
    movements.reduce(
      (summary, movement) => {
        const isSale = movement.reason?.startsWith('Vente ') ?? false

        summary.total += 1
        if (isSale) summary.sales += 1
        if (movement.movement_type === 'in') summary.in += movement.quantity
        if (movement.movement_type === 'out') summary.out += movement.quantity
        if (movement.movement_type === 'adjustment') summary.adjustments += 1

        return summary
      },
      { total: 0, sales: 0, in: 0, out: 0, adjustments: 0 }
    )
  ), [movements])

  const filteredMovements = useMemo(() => (
    movements.filter((movement) => {
      const isSale = movement.reason?.startsWith('Vente ') ?? false

      if (filter === 'all') return true
      if (filter === 'sales') return isSale
      return movement.movement_type === filter
    })
  ), [filter, movements])

  const filterOptions: { value: MovementFilter; label: string; count: number }[] = useMemo(() => [
    { value: 'all', label: 'Tout', count: movementSummary.total },
    { value: 'sales', label: 'Ventes', count: movementSummary.sales },
    {
      value: 'in',
      label: 'Entrees',
      count: movements.filter((movement) => movement.movement_type === 'in').length,
    },
    {
      value: 'out',
      label: 'Sorties',
      count: movements.filter((movement) => movement.movement_type === 'out').length,
    },
    {
      value: 'adjustment',
      label: 'Comptages',
      count: movements.filter((movement) => movement.movement_type === 'adjustment').length,
    },
  ], [movementSummary.sales, movementSummary.total, movements])

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
              {getProductVariantSummary(product) && (
                <p className="mt-0.5 truncate text-xs font-medium text-[#5A4BD4]">
                  {getProductVariantSummary(product)}
                </p>
              )}
              <p className="mt-0.5 text-xs text-[#5C6B73]">Stock actuel : {product.quantity} unite(s)</p>
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

          {!loading && movements.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Mouvements</p>
                  <p className="mt-2 text-lg font-bold text-[#1A3636]">{movementSummary.total}</p>
                  <p className="text-[11px] text-[#6B7682]">historique visible</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-emerald-700">Entrees</p>
                  <p className="mt-2 text-lg font-bold text-[#1A3636]">+{movementSummary.in}</p>
                  <p className="text-[11px] text-[#6B7682]">unite(s) ajoutee(s)</p>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-700">Sorties</p>
                  <p className="mt-2 text-lg font-bold text-[#1A3636]">-{movementSummary.out}</p>
                  <p className="text-[11px] text-[#6B7682]">unite(s) sorties</p>
                </div>
                <div className="rounded-2xl border border-[#6C5CE7]/[0.16] bg-[#6C5CE7]/[0.05] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5A4BD4]">Comptages</p>
                  <p className="mt-2 text-lg font-bold text-[#1A3636]">{movementSummary.adjustments}</p>
                  <p className="text-[11px] text-[#6B7682]">correction(s) manuelle(s)</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      filter === option.value
                        ? 'bg-[#6C5CE7] text-white'
                        : 'border border-[#2D7D7D]/[0.1] bg-white text-[#5C6B73] hover:text-[#1A3636]'
                    }`}
                  >
                    {option.label} ({option.count})
                  </button>
                ))}
              </div>
            </>
          )}

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
              <p className="mt-3 text-sm font-medium text-[#5C6B73]">Aucun mouvement enregistre</p>
              <p className="mt-1 text-xs text-[#6B7682]">Les prochaines entrees, sorties, ventes et corrections apparaitront ici.</p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2D7D7D]/[0.14] px-4 py-8 text-center">
              <History size={24} className="mx-auto text-[#9AA7AE]" />
              <p className="mt-3 text-sm font-medium text-[#5C6B73]">Aucun mouvement pour ce filtre</p>
              <p className="mt-1 text-xs text-[#6B7682]">Essayez un autre angle de lecture pour ce produit.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-[#6B7682]">
                {filteredMovements.length} mouvement(s) affiche(s)
              </p>
              {filteredMovements.map((movement) => {
                const meta = movementMeta[movement.movement_type]
                const Icon = meta.icon
                const isSale = movement.reason?.startsWith('Vente ')
                const delta = getMovementDelta(movement)
                const deltaLabel = `${delta > 0 ? '+' : ''}${delta}`
                const reasonLabel = isSale
                  ? 'Vente enregistree depuis la caisse'
                  : movement.reason || 'Correction manuelle du stock'

                return (
                  <article key={movement.id} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-3">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${meta.iconBox}`}>
                        <Icon size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${meta.badge}`}>
                            {isSale ? 'Vente' : meta.label}
                          </span>
                          <span className="flex-shrink-0 text-sm font-bold text-[#1A3636]">{deltaLabel}</span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1 text-xs text-[#5C6B73] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <span>{movement.previous_quantity} → {movement.new_quantity} unite(s)</span>
                          <span className="flex-shrink-0">{formatDate(movement.created_at)} · {formatTime(movement.created_at)}</span>
                        </div>
                        <p className="mt-2 break-words rounded-lg bg-[#F4F7FB] px-2.5 py-2 text-xs text-[#5C6B73]">
                          {reasonLabel}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {movements.length === 50 && (
            <p className="text-center text-[11px] text-[#6B7682]">Les 50 mouvements les plus recents sont affiches.</p>
          )}
        </div>
      )}
    </Modal>
  )
}
