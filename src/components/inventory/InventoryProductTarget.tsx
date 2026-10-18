'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Package, Pencil, SlidersHorizontal } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { StockAdjustmentModal } from './StockAdjustmentModal'
import { useUser } from '@/hooks/useUser'
import { useAccountRole } from '@/hooks/useAccountRole'
import { canManageInventory } from '@/lib/accountRoles'
import { getProductStockStatus, tracksStock } from '@/lib/productStock'
import { formatCurrency, getProductVariantSummary } from '@/lib/utils'
import { getInventoryProductTarget, type InventoryProductTarget as Target } from '@/lib/supabase/catalogue'
import type { ProductGroup } from '@/types'

interface Props {
  onEditProduct: (group: ProductGroup) => void
  onStockChanged: () => void
  onResolved: () => void
}

export function InventoryProductTarget({ onEditProduct, onStockChanged, onResolved }: Props) {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const productId = params.get('product')
  const { user, accountOwnerId, loading } = useUser()
  const { role, loading: roleLoading } = useAccountRole()
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; target: Target | null; error: string } | null>(null)
  const [adjustingKey, setAdjustingKey] = useState<string | null>(null)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const ready = !!user && !loading && !roleLoading && !!role
  const key = JSON.stringify([user?.id, accountOwnerId, role, productId, revision])
  const current = ready && result?.key === key ? result : null
  const target = current?.target
  const product = target?.product
  const canEdit = ready && canManageInventory(role)
  const adjusting = !!product && canEdit && adjustingKey === key

  useEffect(() => {
    if (!productId) {
      setDismissedKey(null)
      return
    }
    if (!ready) return
    const controller = new AbortController()
    onResolved()
    void getInventoryProductTarget(productId, controller.signal).then((target) => {
      if (!controller.signal.aborted) setResult({ key, target, error: '' })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, target: null, error: error instanceof Error ? error.message : 'Chargement du produit impossible.' })
    })
    return () => controller.abort()
  }, [productId, ready, key, onResolved])

  const close = () => {
    setDismissedKey(key)
    setAdjustingKey(null)
    const next = new URLSearchParams(params.toString())
    next.delete('product')
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false })
  }

  if (!productId || dismissedKey === key) return null
  const status = product ? getProductStockStatus(product) : null

  return (
    <>
      <Modal isOpen={!adjusting} onClose={close} title="Fiche produit" size="md" footer={(
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close}>Fermer</Button>
          {product && canEdit && (
            <>
              <Button variant="outline" size="sm" leftIcon={<Pencil size={14} />} onClick={() => {
                close()
                onEditProduct(target.group)
              }}>Modifier</Button>
              {tracksStock(product) && (
                <Button size="sm" leftIcon={<SlidersHorizontal size={14} />} onClick={() => setAdjustingKey(key)}>Ajuster le stock</Button>
              )}
            </>
          )}
        </div>
      )}>
        {!current ? (
          <div role="status" className="flex items-center gap-2 py-6 text-sm text-[#5C6B73]"><Loader2 size={18} className="animate-spin" />Chargement du produit...</div>
        ) : !product ? (
          <p role="alert" className="py-4 text-sm text-[#5C6B73]">{current.error || "Ce produit n'est plus disponible ou vous n'y avez pas acces."}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F4F7FB]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-contain" /> : <Package size={32} className="text-[#2D7D7D]" />}
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="break-words text-base font-semibold text-[#1A3636]">{product.name}</h3>
                {getProductVariantSummary(product) && <p className="break-words text-sm text-[#5C6B73]">{getProductVariantSummary(product)}</p>}
                <span className={`inline-block rounded-md px-2 py-1 text-xs ${status?.color} ${status?.bg}`}>{status?.label}</span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-[#2D7D7D]/10 py-4 text-sm [&_dd]:break-words [&_dd]:font-semibold [&_dd]:text-[#1A3636] [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-[#5C6B73]">
              <div className="min-w-0"><dt>Stock actuel</dt><dd>{tracksStock(product) ? `${product.quantity} unite(s)` : 'Sans suivi de stock'}</dd></div>
              <div className="min-w-0"><dt>Seuil minimum</dt><dd>{tracksStock(product) ? `${product.min_quantity} unite(s)` : '-'}</dd></div>
              <div className="min-w-0"><dt>Prix de vente</dt><dd>{formatCurrency(product.selling_price, product.currency)}</dd></div>
              <div className="min-w-0"><dt>Categorie</dt><dd>{product.category?.name || '-'}</dd></div>
              <div className="min-w-0"><dt>Code-barres</dt><dd>{product.barcode || '-'}</dd></div>
              <div className="min-w-0"><dt>Reference</dt><dd>{product.sku || '-'}</dd></div>
              {product.supplier && <div className="col-span-2 min-w-0"><dt>Fournisseur</dt><dd>{product.supplier.name}</dd></div>}
            </dl>
            {product.description && <p className="whitespace-pre-wrap break-words text-sm text-[#5C6B73]">{product.description}</p>}
          </div>
        )}
      </Modal>
      <StockAdjustmentModal product={adjusting && product ? product : null} onClose={() => setAdjustingKey(null)} onAdjusted={() => {
        setRevision((value) => value + 1)
        onStockChanged()
      }} />
    </>
  )
}
