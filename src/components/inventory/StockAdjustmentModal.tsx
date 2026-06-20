'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { adjustStock } from '@/lib/supabase/queries'
import type { Product } from '@/types'

interface StockAdjustmentModalProps {
  product: Product | null
  onClose: () => void
  onAdjusted: (productId: string, quantity: number) => void
}

type MovementType = 'in' | 'out'

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
  const isValidQuantity = Number.isInteger(parsedQuantity) && parsedQuantity > 0
  const projectedQuantity = product
    ? product.quantity + (movementType === 'in' ? parsedQuantity || 0 : -(parsedQuantity || 0))
    : 0
  const isValid = isValidQuantity && projectedQuantity >= 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!product || !isValid) return

    setIsLoading(true)
    setError('')
    try {
      const delta = movementType === 'in' ? parsedQuantity : -parsedQuantity
      const newQuantity = await adjustStock(product.id, delta, reason.trim() || undefined)
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
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" isLoading={isLoading} disabled={!isValid} onClick={handleSubmit}>
            Confirmer
          </Button>
        </>
      }
    >
      {product && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl bg-[#F4F7FB] p-4">
            <p className="truncate text-sm font-semibold text-[#1A3636]">{product.name}</p>
            <p className="mt-1 text-xs text-[#5C6B73]">Stock actuel : {product.quantity} unité(s)</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F4F7FB] p-1.5">
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
              <Plus size={16} /> Entrée
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
          </div>

          <Input
            label="Quantité"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            error={quantity && !isValidQuantity ? 'Saisissez un nombre entier positif' : undefined}
          />

          <Input
            label="Motif (optionnel)"
            placeholder={movementType === 'in' ? 'ex : Réapprovisionnement' : 'ex : Produit endommagé'}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />

          <div className={`rounded-xl px-3 py-2.5 text-sm ${
            projectedQuantity < 0
              ? 'bg-red-500/10 text-red-600'
              : 'bg-[#6C5CE7]/[0.08] text-[#5446C8]'
          }`}>
            {projectedQuantity < 0
              ? `Sortie impossible : ${product.quantity} unité(s) disponible(s)`
              : `Nouveau stock : ${projectedQuantity} unité(s)`}
          </div>
        </form>
      )}
    </Modal>
  )
}
