import type { Sale } from '@/types'

export type PaymentPart = { payment_method: Sale['payment_method']; amount: number }

export class CheckoutRejectedError extends Error {}

export function validatePaymentParts(parts: PaymentPart[], total: number): string | null {
  if (!Number.isFinite(total) || total < 0) return 'Total invalide'
  if (parts.length > 4) return 'Quatre modes de paiement maximum'
  const methods = new Set<string>()
  let paid = 0
  for (const part of parts) {
    if (!['cash', 'wave', 'orange_money', 'card'].includes(part.payment_method)) return 'Mode invalide'
    if (!Number.isFinite(part.amount) || part.amount <= 0) return 'Montant invalide'
    if (methods.has(part.payment_method)) return 'Ce mode est deja ajoute'
    methods.add(part.payment_method)
    paid += Math.round(part.amount * 100) / 100
  }
  return paid > Math.round(total * 100) / 100 ? 'Les versements depassent le total' : null
}

export function getItemProfit(revenue: number, quantity: number, snapshot?: number | null, currentCost?: number) {
  const unitCost = snapshot ?? currentCost
  return { profit: unitCost == null ? 0 : revenue - unitCost * quantity, estimated: snapshot == null }
}
