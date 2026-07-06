'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { adjustStock, setStockQuantity } from '@/lib/supabase/queries'
import { getProductVariantSummary } from '@/lib/utils'
import type { Product } from '@/types'

interface StockAdjustmentModalProps {
  product: Product | null
  onClose: () => void
  onAdjusted: (productId: string, quantity: number) => void
}

type MovementType = 'in' | 'out' | 'set'

export function StockAdjustmentModal({ product, onClose, onAdjusted }: StockAdjustmentModalProps) {
  const [movementType, setMovementType] = useState<MovementType>('in')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!product) return
    setMovementType('in')
    setQuantity('1')
    setReason('')
    setError('')
  }, [product])

  const parsedQuantity = Number(quantity)
  const isValidQuantity = movementType === 'set'
    ? Number.isInteger(parsedQuantity) && parsedQuantity >= 0
    : Number.isInteger(parsedQuantity) && parsedQuantity > 0

  const projectedQuantity = product
    ? movementType === 'set'
      ? (Number.isNaN(parsedQuantity) ? product.quantity : parsedQuantity)
      : product.quantity + (movementType === 'in' ? parsedQuantity || 0 : -(parsedQuantity || 0))
    : 0

  const hasChange = !!product && projectedQuantity !== product.quantity
  const isValid = isValidQuantity && projectedQuantity >= 0 && hasChange
  const adjustmentDelta = product ? projectedQuantity - product.quantity : 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!product || !isValid) return

    setIsLoading(true)
    setError('')
    try {
      const newQuantity = movementType === 'set'
        ? await setStockQuantity(product.id, projectedQuantity, reason.trim() || undefined)
        : await adjustStock(
            product.id,
            movementType === 'in' ? parsedQuantity : -parsedQuantity,
            reason.trim() || undefined
          )

      onAdjusted(product.id, newQuantity)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible d'ajuster le stock")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={!!product}
      onClose={onClose}
      title="Ajuster le stock"
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" isLoading={isLoading} disabled={!isValid} onClick={handleSubmit}>
            Confirmer
          </Button>
        </>
      )}
    >
      {product && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl bg-[#F4F7FB] p-4">
            <p className="truncate text-sm font-semibold text-[#1A3636]">{product.name}</p>
            {getProductVariantSummary(product) && (
              <p className="mt-1 truncate text-xs font-medium text-[#5A4BD4]">
                {getProductVariantSummary(product)}
              </p>
            )}
            <p className="mt-1 text-xs text-[#5C6B73]">Stock actuel : {product.quantity} unite(s)</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 rounded-2xl bg-[#F4F7FB] p-1.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setMovementType('in')}
              aria-pressed={movementType === 'in'}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                movementType === 'in'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-[#5C6B73]'
              }`}
            >
              <Plus size={16} /> Entree
            </button>
            <button
              type="button"
              onClick={() => setMovementType('out')}
              aria-pressed={movementType === 'out'}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                movementType === 'out'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-[#5C6B73]'
              }`}
            >
              <Minus size={16} /> Sortie
            </button>
            <button
              type="button"
              onClick={() => setMovementType('set')}
              aria-pressed={movementType === 'set'}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                movementType === 'set'
                  ? 'bg-white text-[#5A4BD4] shadow-sm'
                  : 'text-[#5C6B73]'
              }`}
            >
              <SlidersHorizontal size={16} /> Comptage
            </button>
          </div>

          <Input
            label={movementType === 'set' ? 'Stock reel' : 'Quantite'}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            hint={movementType === 'set' ? 'Entrez la quantite reelle comptee en boutique.' : undefined}
            error={quantity && !isValidQuantity
              ? movementType === 'set'
                ? 'Saisissez un nombre entier superieur ou egal a zero'
                : 'Saisissez un nombre entier positif'
              : undefined}
          />

          <Input
            label="Motif (optionnel)"
            placeholder={
              movementType === 'in'
                ? 'ex : Reapprovisionnement'
                : movementType === 'out'
                  ? 'ex : Produit endommage'
                  : 'ex : Comptage de fin de journee'
            }
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />

          <div className={`rounded-xl px-3 py-2.5 text-sm ${
            projectedQuantity < 0
              ? 'bg-red-500/10 text-red-600'
              : 'bg-[#6C5CE7]/[0.08] text-[#5446C8]'
          }`}>
            {projectedQuantity < 0
              ? `Sortie impossible : ${product.quantity} unite(s) disponible(s)`
              : movementType === 'set'
                ? adjustmentDelta === 0
                  ? `Aucun changement : stock conserve a ${projectedQuantity} unite(s)`
                  : `Stock corrige a ${projectedQuantity} unite(s) (${adjustmentDelta > 0 ? '+' : ''}${adjustmentDelta})`
                : `Nouveau stock : ${projectedQuantity} unite(s)`}
          </div>
        </form>
      )}
    </Modal>
  )
}
