import type { AbroadProduct, Product } from '../src/types'

declare global {
  interface Window {
    abroadAudit: Array<{ action: string; product: Partial<AbroadProduct | Product> }>
    failAbroadUpload?: boolean
  }
}
window.abroadAudit = []
export default function Link() { return null }
let remote: AbroadProduct[] = []
export const getCategories = async () => []
export const getAbroadProducts = async () => remote
export async function saveAbroadProduct(product: Omit<AbroadProduct, 'id' | 'user_id' | 'created_at'>) {
  if (window.failAbroadUpload) throw new Error('Test upload failure')
  const saved = { ...product, id: crypto.randomUUID(), user_id: 'test-owner', created_at: new Date().toISOString(), image_url: product.image_url ? '/photo.png' : null }
  remote = [...remote, saved]
  window.abroadAudit.push({ action: 'save', product })
  return saved
}
export async function updateAbroadProductRecord(id: string, updates: Partial<AbroadProduct>) {
  const saved = { ...remote.find((p) => p.id === id)!, ...updates, image_url: updates.image_url ? '/photo.png' : null }
  remote = remote.map((p) => p.id === id ? saved : p)
  window.abroadAudit.push({ action: 'edit', product: updates })
  return saved
}
export async function activateAbroadProduct(_id: string, product: Product) {
  window.abroadAudit.push({ action: 'transfer', product })
  return product
}
export async function deleteAbroadProduct(id: string) { remote = remote.filter((p) => p.id !== id) }
