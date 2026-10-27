import type { AbroadProduct } from '@/types'

export function getTransferredQuantity(product: AbroadProduct): number {
  return product.transferred_quantity ?? (product.activated ? product.quantity : 0)
}

export function getRemainingQuantity(product: AbroadProduct): number {
  return Math.max(0, product.quantity - getTransferredQuantity(product))
}

export function validateTransferQuantity(value: string, product: AbroadProduct): string | null {
  const quantity = Number(value)
  if (!value.trim() || !Number.isSafeInteger(quantity) || quantity <= 0) {
    return 'La quantite doit etre un nombre entier superieur a zero.'
  }
  if (quantity > getRemainingQuantity(product)) return 'La quantite depasse le reste a transferer.'
  return null
}
