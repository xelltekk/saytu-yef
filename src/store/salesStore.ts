import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product, Sale } from '@/types'
import { formatProductLabel } from '@/lib/utils'

interface SalesState {
  draftOwnerId: string
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
  syncCartStock: (products: Product[]) => void
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
  cart: [],
  sales: [],
  discount: 0,
  taxRate: 0,
  customerName: '',
  customerPhone: '',
  paymentMethod: 'cash',
  isLoading: false,
  setDraftOwner: (draftOwnerId) => set({ draftOwnerId }),
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
  syncCartStock: (products) =>
    set((state) => {
      const productMap = new Map(products.map((product) => [product.id, product]))
      return {
        cart: state.cart.flatMap((item) => {
          const product = productMap.get(item.product_id)
          if (!product || product.status !== 'active' || product.quantity <= 0) return []

          const quantity = Math.min(item.quantity, product.quantity)
          return [{
            ...item,
            product_name: formatProductLabel(product),
            unit_price: product.selling_price,
            quantity,
            total: quantity * product.selling_price,
            max_quantity: product.quantity,
            image_url: product.image_url,
          }]
        }),
      }
    }),
  clearCart: () => set({ cart: [], discount: 0, customerName: '', customerPhone: '' }),
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
      draftOwnerId: state.draftOwnerId,
      discount: state.discount,
      customerName: state.customerName,
      customerPhone: state.customerPhone,
      paymentMethod: state.paymentMethod,
    }),
  })
)
