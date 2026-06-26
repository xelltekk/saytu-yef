import { describe, expect, it } from 'vitest'
import { getSaleAmountDue, getSaleAmountPaid, getSaleComputedStatus } from './sales'

describe('calcul des paiements de vente', () => {
  it('reconnaît une vente entièrement payée', () => {
    const sale = { total: 150_000, amount_paid: 150_000, amount_due: 0, payment_status: 'completed' as const }
    expect(getSaleAmountPaid(sale)).toBe(150_000)
    expect(getSaleAmountDue(sale)).toBe(0)
    expect(getSaleComputedStatus(sale)).toBe('completed')
  })

  it('reconnaît une dette partielle', () => {
    const sale = { total: 100_000, amount_paid: '30000', amount_due: '70000', payment_status: 'partial' as const }
    expect(getSaleAmountPaid(sale)).toBe(30_000)
    expect(getSaleAmountDue(sale)).toBe(70_000)
    expect(getSaleComputedStatus(sale)).toBe('partial')
  })

  it('borne un encaissement supérieur au total', () => {
    const sale = { total: 50_000, amount_paid: 80_000, amount_due: 0, payment_status: 'completed' as const }
    expect(getSaleAmountPaid(sale)).toBe(50_000)
  })

  it('préserve les statuts annulé et remboursé', () => {
    expect(getSaleComputedStatus({ total: 10, payment_status: 'cancelled' })).toBe('cancelled')
    expect(getSaleComputedStatus({ total: 10, payment_status: 'refunded' })).toBe('refunded')
  })
})
