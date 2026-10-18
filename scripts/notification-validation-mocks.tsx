import { useSyncExternalStore, type AnchorHTMLAttributes } from 'react'
import type { Product, ProductGroup } from '../src/types'
import { buildProductGroups } from '../src/lib/productGroups'

const firstId = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
const groupId = '33333333-3333-4333-8333-333333333333'
const products: Product[] = [firstId, secondId].map((id, index) => ({
  id, user_id: 'owner', product_group_id: groupId, name: 'Iphone 8', color: index ? 'Blanc' : 'Noir',
  sku: `IPHONE-${index}`, barcode: `20000000000${index}`, quantity: index ? 0 : 5, min_quantity: 5,
  selling_price: 75000, buying_price: 50000, currency: 'XOF', status: 'active', category_id: '',
  image_url: '/product.png', created_at: '2026-10-17', updated_at: '2026-10-17',
}))
let role: 'admin' | 'cashier' = 'admin'
let delay = 10
let writes = 0
let fail = false
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const notify = () => listeners.forEach((listener) => listener())
const user = { id: 'actor', email: 'fixture@example.invalid' }

declare global {
  interface Window {
    notificationFixture: {
      role: (value: 'admin' | 'cashier') => void
      delay: (value: number) => void
      fail: (value: boolean) => void
      writes: () => number
      navigate: (url: string) => void
    }
  }
}
function navigate(url: string, replace = false) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
window.notificationFixture = {
  role: (value) => { role = value; notify() }, delay: (value) => { delay = value },
  fail: (value) => { fail = value }, writes: () => writes, navigate,
}

export function useAccountRole() {
  const current = useSyncExternalStore(subscribe, () => role)
  return { role: current, loading: false, error: null }
}
export function useUser() {
  useAccountRole()
  return { user, accountOwnerId: 'owner', loading: false, displayName: 'Test', businessName: 'Boutique test', initials: 'TT', email: user.email }
}
const navigationSubscribe = (listener: () => void) => {
  window.addEventListener('popstate', listener)
  return () => window.removeEventListener('popstate', listener)
}
export function useSearchParams() {
  return new URLSearchParams(useSyncExternalStore(navigationSubscribe, () => window.location.search))
}
export function usePathname() {
  return useSyncExternalStore(navigationSubscribe, () => window.location.pathname)
}
const router = { replace: (url: string) => navigate(url, true) }
export const useRouter = () => router
export default function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href} onClick={(event) => {
    onClick?.(event)
    if (!event.defaultPrevented && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      navigate(href || '/')
    }
  }} />
}
export const ensureBrowserSupabaseSession = async () => {}
export function createClient() {
  const query = { select: () => query, eq: () => query, order: () => query,
    limit: async () => ({ data: products, error: null }) }
  return { from: () => query }
}
export async function getInventoryProductTarget(id: string, signal?: AbortSignal) {
  await new Promise((resolve) => setTimeout(resolve, delay))
  if (signal?.aborted) throw new Error('Aborted')
  if (fail) throw new Error('Connexion indisponible')
  const product = products.find((product) => product.id === id)
  return product ? { product: { ...product }, group: buildProductGroups(products)[0] } : null
}
export async function adjustStock(id: string, delta: number) {
  const product = products.find((product) => product.id === id)!
  writes += 1
  product.quantity += delta
  return product.quantity
}
export async function setStockQuantity(id: string, quantity: number) {
  const product = products.find((product) => product.id === id)!
  writes += 1
  product.quantity = quantity
  return quantity
}
export function ProductTable() { return <p>Catalogue de test pagine</p> }
export function AbroadBatchEntry() { return <p>Saisie etranger de test</p> }
export function AddProductModal({ isOpen, productGroup, onClose }: { isOpen: boolean; productGroup?: ProductGroup | null; onClose: () => void }) {
  return isOpen ? <div role="dialog" aria-label="Modification produit"><p>{productGroup?.name} : {productGroup?.variants.length} variantes</p><button onClick={onClose}>Terminer</button></div> : null
}
