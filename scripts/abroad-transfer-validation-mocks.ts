import type { AbroadProduct, AbroadTransfer, Product } from '../src/types'
import { createElement, type ComponentProps } from 'react'
import { getRemainingQuantity, getTransferredQuantity } from '../src/lib/abroadTransfers'
const rows: AbroadProduct[] = [{ id: 'source', user_id: 'fixture', name: 'Telephone avec une reference suffisamment longue pour tester les ecrans etroits',
  quantity: 10, transferred_quantity: 0, activated: false, synced: true, purchase_price: 1500, currency: 'XOF', source_country: 'SN', created_at: '2026-10-27' }]
export default function Link(props: ComponentProps<'a'>) { return createElement('a', props) }
const receipts: AbroadTransfer[] = []
const requests = new Map<string, object>()
let writes = 0
let lostReply = false
let destination: Product | null = null
Object.assign(window, { abroadFixture: { writes: () => writes, lostReply: () => { lostReply = true },
  snapshot: () => ({ source: rows[0], destination, receipts }) } })
export async function getCategories() { return [] }
export async function getAbroadProducts() { return structuredClone(rows) }
export async function getAbroadTransfers() { return structuredClone(receipts).reverse() }
export async function activateAbroadProduct(requestId: string, id: string, quantity: number, options: { expected_transferred: number; buying_price: number; selling_price: number }) {
  await new Promise((resolve) => setTimeout(resolve, 80))
  if (requests.has(requestId)) return structuredClone(requests.get(requestId))
  const row = rows.find((product) => product.id === id)!
  if (quantity > getRemainingQuantity(row) || options.expected_transferred !== getTransferredQuantity(row)) throw new Error('Quantite invalide')
  writes++
  destination ??= { id: 'destination', user_id: 'fixture', name: row.name, quantity: 0, buying_price: options.buying_price, selling_price: options.selling_price } as Product
  destination.quantity += quantity
  row.transferred_quantity = getTransferredQuantity(row) + quantity
  row.activated = row.transferred_quantity === row.quantity
  row.inventory_product_id = destination.id
  const transfer = { id: `receipt-${writes}`, abroad_product_id: id, product_id: destination.id, quantity,
    buying_price: destination.buying_price, selling_price: destination.selling_price, created_at: new Date().toISOString() }
  receipts.push(transfer)
  const result = structuredClone({ abroad: row, product: destination, transfer })
  requests.set(requestId, result)
  if (lostReply) { lostReply = false; throw new Error('Reponse reseau perdue. Reessayez la meme demande.') }
  return result
}
export async function saveAbroadProduct(product: AbroadProduct) { rows.push(product); return product }
export async function updateAbroadProductRecord(id: string, updates: Partial<AbroadProduct>) { const row = rows.find((product) => product.id === id)!; Object.assign(row, updates); return row }
export async function deleteAbroadProduct(id: string) { rows.splice(rows.findIndex((product) => product.id === id), 1) }
