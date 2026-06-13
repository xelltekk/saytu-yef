import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'XOF'): string {
  if (currency === 'XOF') {
    return new Intl.NumberFormat('fr-SN', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount)
  }
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('fr-SN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function formatTime(dateString: string): string {
  return new Intl.DateTimeFormat('fr-SN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function generateSKU(name: string): string {
  const prefix = name.slice(0, 3).toUpperCase().replace(/\s/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${random}`
}

export function getStockStatus(quantity: number, minQuantity: number) {
  if (quantity === 0) return { label: 'Rupture', color: 'text-red-400', bg: 'bg-red-500/10' }
  if (quantity <= minQuantity) return { label: 'Faible', color: 'text-amber-400', bg: 'bg-amber-500/10' }
  return { label: 'En stock', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
}

export function calculateProfit(buyingPrice: number, sellingPrice: number, quantity: number) {
  return (sellingPrice - buyingPrice) * quantity
}

export function getProfitMargin(buyingPrice: number, sellingPrice: number): number {
  if (sellingPrice === 0) return 0
  return ((sellingPrice - buyingPrice) / sellingPrice) * 100
}

const ABROAD_PRODUCTS_KEY = 'saytu_abroad_products'

export function saveAbroadProductsLocally(products: unknown[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ABROAD_PRODUCTS_KEY, JSON.stringify(products))
  }
}

export function loadAbroadProductsLocally(): unknown[] {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ABROAD_PRODUCTS_KEY)
    return stored ? JSON.parse(stored) : []
  }
  return []
}

export function clearAbroadProductsLocally() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ABROAD_PRODUCTS_KEY)
  }
}
