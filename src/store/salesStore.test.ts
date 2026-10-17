import { beforeEach, expect, it } from 'vitest'
import { useSalesStore } from './salesStore'
import type { CartItem, Product } from '@/types'
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

const product = { id:'p1',name:'Mouse',selling_price:5000,quantity:3,status:'active',currency:'XOF' } as Product
it('keeps untracked dishes unlimited in the cart, across refresh and hold/resume', () => {
  const state = useSalesStore.getState()
  state.addToCart({...item, max_quantity:0, track_stock:false})
  for (let i=0;i<15;i++) state.addToCart({...item,max_quantity:0,track_stock:false})
  state.syncCartStock([{...product,quantity:0,track_stock:false}],['p1'])
  expect(useSalesStore.getState().cart[0]).toMatchObject({quantity:16,total:80000,track_stock:false})
  state.holdCart(); state.resumeCart(useSalesStore.getState().heldCarts[0].id)
  state.updateCartQuantity('p1',25)
  expect(useSalesStore.getState().cart[0].quantity).toBe(25)
  state.syncCartStock([{...product,quantity:0,track_stock:false,is_available:false}],['p1'])
  expect(useSalesStore.getState().cart).toEqual([])
})
it('only changes stock for explicitly checked cart IDs, keeping off-page and recently added articles', () => {
  const state = useSalesStore.getState()
  state.addToCart(item)
  state.addToCart({ ...item, product_id:'p2' })
  state.syncCartStock([product],['p1'])
  expect(useSalesStore.getState().cart.map((entry) => entry.product_id)).toEqual(['p1','p2'])
  state.syncCartStock([],['p1'])
  expect(useSalesStore.getState().cart.map((entry) => entry.product_id)).toEqual(['p2'])
})
it('does not change a retry payload with unknown checkout outcome during background stock refresh', () => {
  const state = useSalesStore.getState()
  state.addToCart(item)
  state.getCheckoutRequestId('pending')
  state.syncCartStock([],['p1'])
  expect(useSalesStore.getState().cart).toEqual([item])
})
it('refreshes price and maximum quantity before consecutive scans', () => {
  const state = useSalesStore.getState()
  state.addToCart(item)
  state.syncCartStock([{ ...product, quantity:2, selling_price:7000 }],['p1'])
  state.addToCart(item)
  state.addToCart(item)
  expect(useSalesStore.getState().cart[0]).toMatchObject({ quantity:2, unit_price:7000, total:14000, max_quantity:2 })
})
