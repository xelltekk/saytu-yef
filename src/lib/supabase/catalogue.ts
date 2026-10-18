import type { Category, Product, ProductGroup, Supplier } from '@/types'
import { buildProductGroups } from '@/lib/productGroups'
import { normalizeBarcodeLookupValue } from '@/lib/barcodes'
import { createClient, ensureBrowserSupabaseSession } from './client'
import { getAccountContext } from './account'
import { isProductAvailable } from '@/lib/productStock'

export type CatalogueOptions = {
  scope?: 'inventory' | 'pos'; search?: string; category?: string; supplier?: string
  stock?: string; sort?: string; group?: string; offset?: number; limit?: number; images?: boolean
}
export const emptyCatalogueSummary = {
  products: 0, variants: 0, units: 0, buyingValue: 0, sellingValue: 0,
  lowVariants: 0, outVariants: 0, restockProducts: 0, restockUnits: 0, restockCost: 0,
}
export type CataloguePage = {
  ownerId: string; version: string; products: Product[]; groupIds: string[]; totalGroups: number
  totalVariants: number; offset: number; limit: number; categories: Category[]; suppliers: Supplier[]
  summary: typeof emptyCatalogueSummary; excludedCurrencyCount: number
}

function checkError(error: { code?: string; message: string } | null) {
  if (!error) return
  if (error.code === 'PGRST202' || error.code === '42883') {
    throw new Error('La migration de pagination du catalogue doit etre appliquee dans Supabase.')
  }
  throw new Error(error.message)
}

async function catalogueRpc<T>(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const account = await getAccountContext()
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  const request = client.rpc(name, args)
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  checkError(error)
  const current = await getAccountContext()
  const ownerId = account.business?.id ?? account.user.id
  if (current.user.id !== account.user.id || (current.business?.id ?? current.user.id) !== ownerId || data?.ownerId !== ownerId) {
    throw new Error('Session modifiee, veuillez reessayer')
  }
  return data as T
}

export function getCataloguePage(options: CatalogueOptions, signal?: AbortSignal) {
  return catalogueRpc<CataloguePage>('list_catalogue_page', {
    p_options: { ...options, code: normalizeBarcodeLookupValue(options.search) },
  }, signal)
}

export type InventoryProductTarget = { product: Product; group: ProductGroup }

// Resolve the exact variant without depending on the current catalogue page or filters.
export async function getInventoryProductTarget(productId: string, signal?: AbortSignal): Promise<InventoryProductTarget | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) return null
  const initial = await getAccountContext()
  const ownerId = initial.business?.id ?? initial.user.id
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  const request = client.from('products').select('id,product_group_id').eq('user_id', ownerId).eq('id', productId)
  const { data, error } = await (signal ? request.abortSignal(signal) : request).maybeSingle()
  checkError(error)
  const groupId = data?.product_group_id || productId
  const page = data ? await getCataloguePage({ scope: 'inventory', group: groupId, limit: 1 }, signal) : null
  const current = await getAccountContext()
  if (current.user.id !== initial.user.id || (current.business?.id ?? current.user.id) !== ownerId
    || current.member?.role !== initial.member?.role || (page && page.ownerId !== ownerId)) {
    throw new Error('Session modifiee, veuillez reessayer')
  }
  const group = page ? buildProductGroups(page.products).find((item) => item.id === groupId) : undefined
  const product = group?.variants.find((item) => item.id === productId)
  return group && product ? { product, group } : null
}

export async function lookupCatalogueCode(code: string, scope: 'inventory' | 'pos') {
  const normalized = normalizeBarcodeLookupValue(code)
  if (!normalized) return null
  const result = await catalogueRpc<{ ownerId: string; product: Product | null }>('lookup_catalogue_code', {
    p_code: code.trim(), p_scope: scope,
  })
  return result.product
}

// Bulk actions are explicit and omit photos; normal navigation never calls this.
export async function getCatalogueExport(options: CatalogueOptions, signal?: AbortSignal) {
  const initial = await getAccountContext()
  const ownerId = initial.business?.id ?? initial.user.id
  let version: string | undefined
  const products = new Map<string, Product>()
  for (let offset = 0; ; offset += 50) {
    if (signal?.aborted) throw new Error('Chargement annule')
    if ((await getAccountContext()).user.id !== initial.user.id) throw new Error('Session modifiee, veuillez reessayer')
    const page = await getCataloguePage({ ...options, offset, limit: 50, images: false }, signal)
    if (page.ownerId !== ownerId) throw new Error('Session modifiee, veuillez reessayer')
    if (version !== undefined && page.version !== version) {
      throw new Error("Le catalogue a change pendant l'export. Relancez pour obtenir un fichier complet.")
    }
    version = page.version
    page.products.forEach((product) => products.set(product.id, product))
    if (offset + page.limit >= page.totalGroups) return [...products.values()]
  }
}

export async function getCartProducts(ids: string[], signal?: AbortSignal) {
  const account = await getAccountContext()
  const ownerId = account.business?.id ?? account.user.id
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  const products: Product[] = []
  const uniqueIds = [...new Set(ids)]
  for (let offset = 0; offset < uniqueIds.length; offset += 50) {
    const request = client.from('products').select('*').eq('user_id', ownerId).in('id', uniqueIds.slice(offset, offset + 50))
    const { data, error } = await (signal ? request.abortSignal(signal) : request)
    checkError(error)
    products.push(...(data as Product[]))
  }
  const current = await getAccountContext()
  if (current.user.id !== account.user.id || (current.business?.id ?? current.user.id) !== ownerId) {
    throw new Error('Session modifiee, veuillez reessayer')
  }
  return products.filter((product) => isProductAvailable(product) && product.currency === 'XOF')
}
