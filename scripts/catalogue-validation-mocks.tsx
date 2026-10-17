import type { ComponentProps } from 'react'
import type { CatalogueOptions, CataloguePage } from '../src/lib/supabase/catalogue'
import type { Product } from '../src/types'
import { buildProductGroups } from '../src/lib/productGroups'
import { normalizeBarcodeLookupValue } from '../src/lib/barcodes'
import { isProductAvailable, tracksStock } from '../src/lib/productStock'

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
const restaurant = new URLSearchParams(location.search).has('restaurant')
if (restaurant) {
  products.splice(0, products.length,
    {...products[0],id:'dish',product_group_id:'dish-group',name:'Yassa',size:'',color:'',quantity:0,track_stock:false,is_available:true},
    {...products[1],id:'portions',product_group_id:'portions-group',name:'Thieb',size:'',color:'',quantity:3,track_stock:true,is_available:true},
    {...products[2],id:'drink',product_group_id:'drink-group',name:'Boisson',size:'',color:'',quantity:2,track_stock:true,is_available:true},
  )
}
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
  const scoped = products.filter((product) => options.scope !== 'pos' || isProductAvailable(product))
  const allGroups = buildProductGroups(scoped)
  const tracked = scoped.filter(tracksStock)
  const groups = allGroups.filter((group) => (!options.group || options.group===group.id)
    && (!query || group.name.toLowerCase().includes(query)
      || group.variants.some((p) => normalizeBarcodeLookupValue(p.barcode).includes(code))))
  const offset=options.offset ?? 0,limit=options.limit ?? 24
  const selected=groups.slice(offset,offset+limit)
  return {ownerId:'owner',version:'stable',offset,limit,totalGroups:groups.length,totalVariants:groups.reduce((sum,g) => sum+g.variant_count,0),
    groupIds:selected.map((group) => group.id),products:selected.flatMap((group) => group.variants.map((p) => ({...p,image_url:options.images===false ? undefined : image}))),
    categories:[],suppliers:[],excludedCurrencyCount:0,
    summary:{products:allGroups.length,variants:scoped.length,units:tracked.reduce((n,p) => n+p.quantity,0),
      buyingValue:tracked.reduce((n,p) => n+p.quantity*p.buying_price,0),sellingValue:tracked.reduce((n,p) => n+p.quantity*p.selling_price,0),
      lowVariants:tracked.filter((p) => p.quantity>0 && p.quantity<=p.min_quantity).length,outVariants:tracked.filter((p) => !p.quantity).length,
      restockProducts:allGroups.filter((g) => g.variants.some((p) => tracksStock(p) && p.quantity<=p.min_quantity)).length,
      restockUnits:tracked.reduce((n,p) => n+Math.max(0,p.min_quantity-p.quantity+1),0),
      restockCost:tracked.reduce((n,p) => n+Math.max(0,p.min_quantity-p.quantity+1)*p.buying_price,0)},
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
export async function lookupCatalogueCode(code: string, scope?: string) {
  await new Promise((resolve) => setTimeout(resolve,20))
  return products.find((p) => (scope !== 'pos' || isProductAvailable(p)) && normalizeBarcodeLookupValue(p.barcode)===normalizeBarcodeLookupValue(code)) ?? null
}
export async function getCartProducts(ids:string[]) { return products.filter((p) => ids.includes(p.id) && isProductAvailable(p)) }
export async function deleteProductGroup() { throw new Error('Ecriture interdite dans ce test') }
export async function setProductAvailability(id:string, available:boolean) {
  if (!restaurant) throw new Error('Ecriture interdite dans ce test')
  const product = products.find((p) => p.id === id)!
  product.is_available = available
  return {...product}
}
export async function getProducts() { return products.map((p) => ({...p})) }
export async function createProductGroup(input: {name:string;currency:string;variants:Array<Partial<Product>>}) {
  if (!restaurant) throw new Error('Ecriture interdite dans ce test')
  const groupId = crypto.randomUUID()
  products.push(...input.variants.map((variant) => ({...products[0], ...variant, name:input.name,currency:input.currency,id:crypto.randomUUID(),product_group_id:groupId})))
  return buildProductGroups(products).find((g) => g.id === groupId)!
}
export async function updateProductGroup() { throw new Error('Non utilise dans ce test') }
export async function uploadProductImage(image:string) { return image }
export async function createSale() {
  if (!restaurant) throw new Error('Ecriture interdite dans ce test')
  return {id:crypto.randomUUID(),created_at:new Date().toISOString()}
}
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
