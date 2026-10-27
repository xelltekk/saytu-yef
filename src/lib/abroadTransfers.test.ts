import { expect, it } from 'vitest'
import type { AbroadProduct } from '@/types'
import { getRemainingQuantity, getTransferredQuantity, validateTransferQuantity } from './abroadTransfers'

const source = { quantity: 10, activated: false } as AbroadProduct
it('preserves old complete and pending entries without a counter', () => {
  expect(getTransferredQuantity(source)).toBe(0)
  expect(getRemainingQuantity({ ...source, activated: true })).toBe(0)
})
it('calculates the exact remaining balance for partial shipments', () => {
  expect(getRemainingQuantity({ ...source, transferred_quantity: 4 })).toBe(6)
  expect(validateTransferQuantity('6', { ...source, transferred_quantity: 4 })).toBeNull()
  expect(validateTransferQuantity('7', { ...source, transferred_quantity: 4 })).toMatch(/depasse/)
})
it.each(['', ' ', '0', '-1', '1.5', 'Infinity', 'NaN', '9007199254740992'])('rejects invalid quantity %s', (value) => {
  expect(validateTransferQuantity(value, source)).toMatch(/entier/)
})
