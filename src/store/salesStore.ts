import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product, Sale } from '@/types'
import { formatProductLabel } from '@/lib/utils'

type HeldCart = { id: string; cart: CartItem[]; discount: number; customerName: string; customerPhone: string; paymentMethod: SalesState['paymentMethod']; checkoutRequest: SalesState['checkoutRequest'] }

interface SalesState {
  draftOwnerId: string
  heldCarts: HeldCart[]
  checkoutRequest: { id: string; fingerprint: string } | null
  holdCart: () => void
  resumeCart: (id: string) => void
  deleteHeldCart: (id: string) => void
  getCheckoutRequestId: (fingerprint: string) => string
  cart: CartItem[]
  sales: Sale[]
  discount: number
  taxRate: number
  customerName: string
  customerPhone: string
  paymentMethod: 'cash' | 'wave' | 'orange_money' | 'card'
  isLoading: boolean
  setDraftOwner: (userId: string) => void
  addToCart: (item: CartItem) => void
  removeFromCart: (productId: string) => void
  updateCartQuantity: (productId: string, quantity: number) => void
  syncCartStock: (products: Product[], checkedIds?: string[]) => void
  clearCart: () => void
  setDiscount: (discount: number) => void
  setTaxRate: (taxRate: number) => void
  setCustomer: (name: string, phone: string) => void
  setPaymentMethod: (method: 'cash' | 'wave' | 'orange_money' | 'card') => void
  setSales: (sales: Sale[]) => void
  addSale: (sale: Sale) => void
  setLoading: (loading: boolean) => void
  getSubtotal: () => number
  getTotal: () => number
}

export const useSalesStore = create<SalesState>()(
  persist((set, get) => ({
  draftOwnerId: '',
  heldCarts: [],
  checkoutRequest: null,
  holdCart: () => {
    const state = get()
    if (!state.cart.length || state.heldCarts.length >= 20) return
    set({ heldCarts: [...state.heldCarts, { id: crypto.randomUUID(), cart: state.cart, discount: state.discount,
      customerName: state.customerName, customerPhone: state.customerPhone, paymentMethod: state.paymentMethod, checkoutRequest: state.checkoutRequest }],
      cart: [], discount: 0, customerName: '', customerPhone: '', checkoutRequest: null })
  },
  resumeCart: (id) => {
    const state = get()
    const draft = state.heldCarts.find((entry) => entry.id === id)
    if (!draft || state.cart.length) return
    set({ cart: draft.cart, discount: draft.discount, customerName: draft.customerName, customerPhone: draft.customerPhone,
      paymentMethod: draft.paymentMethod, heldCarts: state.heldCarts.filter((entry) => entry.id !== id), checkoutRequest: draft.checkoutRequest ?? null })
  },
  deleteHeldCart: (id) => set((state) => ({ heldCarts: state.heldCarts.filter((entry) => entry.id !== id) })),
  getCheckoutRequestId: (fingerprint) => {
    if (get().checkoutRequest?.fingerprint === fingerprint) return get().checkoutRequest!.id
    if (get().checkoutRequest) throw new Error("La precedente tentative n'est pas confirmee. Reessayez avec les memes informations ou verifiez l'historique avant de changer le panier.")
    const id = crypto.randomUUID()
    set({ checkoutRequest: { id, fingerprint } })
    return id
  },
  cart: [],
  sales: [],
  discount: 0,
  taxRate: 0,
  customerName: '',
  customerPhone: '',
  paymentMethod: 'cash',
  isLoading: false,
  setDraftOwner: (draftOwnerId) => set((state) => state.draftOwnerId && state.draftOwnerId !== draftOwnerId
    ? { draftOwnerId, heldCarts: [], checkoutRequest: null, cart: [], discount: 0, customerName: '', customerPhone: '' }
    : { draftOwnerId }),
  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((c) => c.product_id === item.product_id)
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + 1, existing.max_quantity)
        return {
          cart: state.cart.map((c) =>
            c.product_id === item.product_id
              ? { ...c, quantity: nextQuantity, total: nextQuantity * c.unit_price }
              : c
          ),
        }
      }
      return { cart: [...state.cart, item] }
    }),
  removeFromCart: (productId) =>
    set((state) => ({ cart: state.cart.filter((c) => c.product_id !== productId) })),
  updateCartQuantity: (productId, quantity) =>
    set((state) => ({
      cart: state.cart.map((c) =>
        c.product_id === productId ? (() => {
          const nextQuantity = Math.max(1, Math.min(quantity, c.max_quantity))
          return { ...c, quantity: nextQuantity, total: nextQuantity * c.unit_price }
        })() : c
      ),
    })),
  syncCartStock: (products, checkedIds) =>
    set((state) => {
      if (state.checkoutRequest) return state
      const productMap = new Map(products.map((product) => [product.id, product]))
      const checked = checkedIds ? new Set(checkedIds) : null
      return {
        cart: state.cart.flatMap((item) => {
          if (checked && !checked.has(item.product_id)) return [item]
          const product = productMap.get(item.product_id)
          if (!product || product.status !== 'active' || product.quantity <= 0 || product.currency !== 'XOF') return []

          const quantity = Math.min(item.quantity, product.quantity)
          return [{
            ...item,
            product_name: formatProductLabel(product),
            product_base_name: product.name,
            variant_label: [product.size?.trim(), product.color?.trim()].filter(Boolean).join(' · '),
            unit_price: product.selling_price,
            quantity,
            total: quantity * product.selling_price,
            max_quantity: product.quantity,
            image_url: product.image_url,
            size: product.size,
            color: product.color,
            sku: product.sku,
            barcode: product.barcode,
          }]
        }),
      }
    }),
  clearCart: () => set({ cart: [], discount: 0, customerName: '', customerPhone: '', checkoutRequest: null }),
  setDiscount: (discount) => set({ discount: Math.max(0, Math.min(discount, 100)) }),
  setTaxRate: (taxRate) => set({ taxRate: Math.max(0, Math.min(taxRate, 100)) }),
  setCustomer: (customerName, customerPhone) => set({ customerName, customerPhone }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setSales: (sales) => set({ sales }),
  addSale: (sale) => set((state) => ({ sales: [sale, ...state.sales] })),
  setLoading: (isLoading) => set({ isLoading }),
  getSubtotal: () => get().cart.reduce((sum, item) => sum + item.total, 0),
  getTotal: () => {
    const subtotal = get().getSubtotal()
    const discount = get().discount
    const discountedSubtotal = subtotal - (subtotal * discount) / 100
    return discountedSubtotal + (discountedSubtotal * get().taxRate) / 100
  },
  }), {
    name: 'saytu-yef-sales-draft',
    version: 1,
    partialize: (state) => ({
      cart: state.cart,
      heldCarts: state.heldCarts,
      checkoutRequest: state.checkoutRequest,
      draftOwnerId: state.draftOwnerId,
      discount: state.discount,
      customerName: state.customerName,
      customerPhone: state.customerPhone,
      paymentMethod: state.paymentMethod,
    }),
  })
)
