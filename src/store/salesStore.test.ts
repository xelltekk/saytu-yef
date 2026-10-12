import { beforeEach, expect, it } from 'vitest'
import { useSalesStore } from './salesStore'
import type { CartItem } from '@/types'
const item: CartItem = { product_id:'p1',product_name:'Mouse',quantity:1,unit_price:5000,total:5000,max_quantity:5 }
beforeEach(() => useSalesStore.setState({ draftOwnerId:'owner1',cart:[],heldCarts:[],checkoutRequest:null,discount:0,customerName:'',customerPhone:'' }))
it('never generates another checkout identity while a previous outcome is unknown', () => {
  const state = useSalesStore.getState()
  const id = state.getCheckoutRequestId('first')
  expect(() => state.getCheckoutRequestId('changed')).toThrow(/precedente tentative/)
  expect(state.getCheckoutRequestId('first')).toBe(id)
})
it('holds and resumes the customer, discount and retry identity without losing another cart', () => {
  const state = useSalesStore.getState()
  state.addToCart(item); state.setCustomer('Client A','771234567'); state.setDiscount(10)
  const id = state.getCheckoutRequestId('payload')
  state.holdCart()
  expect(useSalesStore.getState().cart).toHaveLength(0)
  expect(useSalesStore.getState().heldCarts).toHaveLength(1)
  state.resumeCart(useSalesStore.getState().heldCarts[0].id)
  expect(useSalesStore.getState().getTotal()).toBe(4500)
  expect(useSalesStore.getState().customerName).toBe('Client A')
  expect(state.getCheckoutRequestId('payload')).toBe(id)
})
it('never exposes another user draft or pending carts after switching accounts', () => {
  const state = useSalesStore.getState(); state.addToCart(item); state.holdCart(); state.addToCart(item)
  state.setDraftOwner('owner2')
  expect(useSalesStore.getState().cart).toEqual([])
  expect(useSalesStore.getState().heldCarts).toEqual([])
})
it('does not replace a nonempty cart when resuming a pending one', () => {
  const state = useSalesStore.getState(); state.addToCart(item); state.holdCart(); state.addToCart({ ...item,product_id:'p2' })
  state.resumeCart(useSalesStore.getState().heldCarts[0].id)
  expect(useSalesStore.getState().cart[0].product_id).toBe('p2')
  expect(useSalesStore.getState().heldCarts).toHaveLength(1)
})
