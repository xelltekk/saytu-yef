import type { ComponentProps } from 'react'
import type { CatalogueOptions, CataloguePage } from '../src/lib/supabase/catalogue'
import type { Product } from '../src/types'
import { buildProductGroups } from '../src/lib/productGroups'
import { normalizeBarcodeLookupValue } from '../src/lib/barcodes'

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMioAAAAASUVORK5CYII='
const products: Product[] = Array.from({length:120},(_,index) => ({
  id:`p${index+1}`,user_id:'owner',product_group_id:`g${Math.floor(index/2)+1}`,
  name:`Produit ${String(Math.floor(index/2)+1).padStart(3,'0')}`,
  description:'Article de test sans vente reelle',sku:`SKU-${index+1}`,barcode:`CODE-${index+1}`,
  category_id:'',
  size:index%2 ? 'XL' : 'S',color:index%2 ? 'Noir' : 'Blanc',quantity:5,min_quantity:6,
  buying_price:2000,selling_price:5000,currency:'XOF',status:'active',image_url:image,
  created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',
}))
const calls: CatalogueOptions[] = []
Object.assign(window,{catalogueCalls:calls})
const user={id:'cashier',user_metadata:{}}
const business={id:'owner'}
export function useUser() { return {user,business,accountOwnerId:business.id,businessName:'Boutique test'} }
export function useSubscriptionOverview() { return {overview:null} }
export default function Link(props: ComponentProps<'a'>) { return <a {...props} /> }
export async function getCataloguePage(options: CatalogueOptions): Promise<CataloguePage> {
  calls.push(options)
  await new Promise((resolve) => setTimeout(resolve,options.search==='Produit 001' ? 450 : 15))
  const query = options.search?.toLowerCase() ?? ''
  const code = normalizeBarcodeLookupValue(options.search)
  const groups = buildProductGroups(products).filter((group) => (!options.group || options.group===group.id)
    && (!query || group.name.toLowerCase().includes(query)
      || group.variants.some((p) => normalizeBarcodeLookupValue(p.barcode).includes(code))))
  const offset=options.offset ?? 0,limit=options.limit ?? 24
  const selected=groups.slice(offset,offset+limit)
  return {ownerId:'owner',version:'stable',offset,limit,totalGroups:groups.length,totalVariants:groups.length*2,
    groupIds:selected.map((group) => group.id),products:selected.flatMap((group) => group.variants.map((p) => ({...p,image_url:options.images===false ? undefined : image}))),
    categories:[],suppliers:[],excludedCurrencyCount:0,
    summary:{products:60,variants:120,units:600,buyingValue:1200000,sellingValue:3000000,lowVariants:120,outVariants:0,restockProducts:60,restockUnits:240,restockCost:480000},
  }
}
export async function getCatalogueExport(options: CatalogueOptions,signal?: AbortSignal) {
  const rows: Product[]=[]
  for(let offset=0;;offset+=50) {
    const page=await getCataloguePage({...options,offset,limit:50,images:false})
    if(signal?.aborted) throw new Error('annule')
    rows.push(...page.products)
    if(offset+50>=page.totalGroups) return rows
  }
}
export async function lookupCatalogueCode(code: string) {
  await new Promise((resolve) => setTimeout(resolve,20))
  return products.find((p) => normalizeBarcodeLookupValue(p.barcode)===normalizeBarcodeLookupValue(code)) ?? null
}
export async function getCartProducts(ids:string[]) { return products.filter((p) => ids.includes(p.id)) }
export async function deleteProductGroup() { throw new Error('Ecriture interdite dans ce test') }
export const addCategory=deleteProductGroup
export const updateCategory=deleteProductGroup
export const deleteCategory=deleteProductGroup
export const adjustStock=deleteProductGroup
export const setStockQuantity=deleteProductGroup
export async function getStockMovements() { return [] }
export const emptyCatalogueSummary = {products:0,variants:0,units:0,buyingValue:0,sellingValue:0,lowVariants:0,outVariants:0,restockProducts:0,restockUnits:0,restockCost:0}
export async function getCategories() { return [] }
export async function getSuppliers() { return [] }
export async function getCustomerAccounts() { return {customers:[]} }
