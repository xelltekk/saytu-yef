import { expect, it } from 'vitest'
import { expenseMonthRange, isBusinessOwner, validateExpense, type ExpenseDraft } from './expenses'
const draft: ExpenseDraft = { label:'Loyer',amount:100000,category:'rent',expense_date:'2026-10-01',payment_method:'cash',notes:'',receipt_path:null }
it('only treats the business owner as authorised, not delegated administrators', () => {
  expect(isBusinessOwner('owner','owner','admin')).toBe(true)
  for (const role of ['admin','employee','cashier',null]) expect(isBusinessOwner('staff','owner',role)).toBe(false)
  expect(isBusinessOwner('owner','owner','employee')).toBe(false)
  expect(isBusinessOwner(undefined,undefined,'admin')).toBe(false)
})
it('resolves month boundaries, leap years and December without UTC date shifts', () => {
  expect(expenseMonthRange('2026-12')).toEqual({startDate:'2026-12-01',endExclusive:'2027-01-01'})
  expect(expenseMonthRange('2028-02')).toEqual({startDate:'2028-02-01',endExclusive:'2028-03-01'})
  expect(() => expenseMonthRange('2026-13')).toThrow()
})
it('validates integer FCFA amounts and exact calendar dates before upload or save', () => {
  expect(() => validateExpense(draft)).not.toThrow()
  for (const amount of [NaN,Infinity,-1,0,10.5,1000000000000]) expect(() => validateExpense({...draft,amount})).toThrow()
  for (const expense_date of ['2026-02-30','2026-13-01','bad','1999-12-31']) expect(() => validateExpense({...draft,expense_date})).toThrow()
  expect(() => validateExpense({...draft,label:'   '})).toThrow()
})
