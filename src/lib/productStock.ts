import type { Product, ProductGroup } from '@/types'
import { getStockStatus } from './utils'

type StockProduct = Pick<Product, 'quantity' | 'track_stock' | 'is_available' | 'status'>

export function tracksStock(product: Pick<Product, 'track_stock'>) {
  return product.track_stock !== false
}

export function isProductAvailable(product: StockProduct) {
  return product.status === 'active' && product.is_available !== false
    && (!tracksStock(product) || product.quantity > 0)
}

export function getProductStockStatus(product: StockProduct & Pick<Product, 'min_quantity'>) {
  if (product.is_available === false || product.status !== 'active') {
    return { label: 'Indisponible', color: 'text-red-600', bg: 'bg-red-500/10' }
  }
  return tracksStock(product) ? getStockStatus(product.quantity, product.min_quantity)
    : { label: 'Disponible', color: 'text-emerald-600', bg: 'bg-emerald-500/10' }
}

export function getGroupQuantityLabel(group: ProductGroup) {
  const untracked = group.variants.filter((product) => !tracksStock(product)).length
  if (untracked === group.variants.length) return 'Sans suivi de stock'
  return `${group.quantity} unite(s)${untracked ? ` + ${untracked} sans suivi` : ''}`
}
