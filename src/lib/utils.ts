import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'XOF'): string {
  if (currency === 'XOF') {
    // Affichage déterministe en FCFA (insensible au moteur Intl)
    const n = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${n} FCFA`
  }
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencyCompact(amount: number, currency = 'XOF'): string {
  if (currency !== 'XOF') {
    return formatCurrency(amount, currency)
  }

  const absolute = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  if (absolute < 1000) {
    return `${sign}${absolute} FCFA`
  }

  if (absolute < 1_000_000) {
    return `${sign}${Math.round(absolute / 1000)} k FCFA`
  }

  if (absolute < 10_000_000) {
    return `${sign}${(absolute / 1_000_000).toFixed(1).replace('.', ',')} M FCFA`
  }

  if (absolute < 1_000_000_000) {
    return `${sign}${Math.round(absolute / 1_000_000)} M FCFA`
  }

  return `${sign}${(absolute / 1_000_000_000).toFixed(1).replace('.', ',')} Md FCFA`
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
  if (quantity === 0) return { label: 'Rupture', color: 'text-red-600', bg: 'bg-red-500/10' }
  if (quantity <= minQuantity) return { label: 'Faible', color: 'text-amber-600', bg: 'bg-amber-500/10' }
  return { label: 'En stock', color: 'text-emerald-600', bg: 'bg-emerald-500/10' }
}

/**
 * Redimensionne et compresse une image (File) en data URL JPEG.
 * Garde l'image légère pour stockage en base (max ~maxSize px).
 */
export function compressImage(file: File, maxSize = 700, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Image invalide'))
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas non disponible'))
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
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
