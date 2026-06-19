import type { Sale } from '@/types'

export const SALE_METHOD_LABELS: Record<Sale['payment_method'], string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  cash: 'Especes',
  card: 'Carte',
}

export const SALE_METHOD_VARIANTS: Record<Sale['payment_method'], 'info' | 'warning' | 'default'> = {
  wave: 'info',
  orange_money: 'warning',
  cash: 'default',
  card: 'default',
}

export const SALE_STATUS_LABELS: Record<Sale['payment_status'], string> = {
  completed: 'Paye',
  partial: 'Partiel',
  pending: 'En attente',
  cancelled: 'Annule',
  refunded: 'Rembourse',
}

export const SALE_STATUS_VARIANTS: Record<Sale['payment_status'], 'success' | 'warning' | 'default' | 'danger' | 'info'> = {
  completed: 'success',
  partial: 'warning',
  pending: 'default',
  cancelled: 'danger',
  refunded: 'info',
}

type SalePaymentSnapshot = Pick<Sale, 'total' | 'payment_status'> & {
  amount_paid?: number | string
  amount_due?: number | string
}

function toMoneyValue(value: number | string | undefined, fallback = 0): number {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback
}

export function getSaleAmountPaid(sale: SalePaymentSnapshot): number {
  const total = toMoneyValue(sale.total)
  const fallbackPaid = sale.payment_status === 'completed' ? total : 0
  const rawPaid = toMoneyValue(sale.amount_paid, fallbackPaid)
  return Math.max(0, Math.min(rawPaid, total))
}

export function getSaleAmountDue(sale: SalePaymentSnapshot): number {
  const total = toMoneyValue(sale.total)
  const rawDue = toMoneyValue(sale.amount_due, Number.NaN)

  if (!Number.isNaN(rawDue)) {
    return Math.max(0, rawDue)
  }

  return Math.max(0, total - getSaleAmountPaid(sale))
}

export function getSaleComputedStatus(sale: SalePaymentSnapshot): Sale['payment_status'] {
  if (sale.payment_status === 'cancelled' || sale.payment_status === 'refunded') {
    return sale.payment_status
  }

  const amountDue = getSaleAmountDue(sale)
  const amountPaid = getSaleAmountPaid(sale)

  if (amountDue <= 0) return 'completed'
  if (amountPaid > 0) return 'partial'
  return 'pending'
}
