import { describe, expect, it } from 'vitest'
import { getItemProfit, validatePaymentParts } from './checkout'

describe('checkout payments', () => {
  it('accepts mixed partial payments on a discounted sale', () => {
    expect(validatePaymentParts([{ payment_method: 'cash', amount: 20000 }, { payment_method: 'wave', amount: 5000 }], 31500)).toBeNull()
  })
  it('rejects overpayments, duplicates and non finite values', () => {
    expect(validatePaymentParts([{ payment_method: 'cash', amount: 100 }], 90)).not.toBeNull()
    expect(validatePaymentParts([{ payment_method: 'cash', amount: 10 }, { payment_method: 'cash', amount: 10 }], 90)).not.toBeNull()
    expect(validatePaymentParts([{ payment_method: 'cash', amount: Infinity }], 90)).not.toBeNull()
  })
  it('supports a debt without initial payment', () => expect(validatePaymentParts([], 100)).toBeNull())
})
describe('historical profit', () => {
  it('never replaces the captured purchase price with the current price', () => {
    expect(getItemProfit(100, 2, 20, 45)).toEqual({ profit: 60, estimated: false })
  })
  it('marks legacy sales as estimates including a zero cost', () => {
    expect(getItemProfit(100, 2, null, 30)).toEqual({ profit: 40, estimated: true })
    expect(getItemProfit(100, 2, 0, 30)).toEqual({ profit: 100, estimated: false })
  })
})
