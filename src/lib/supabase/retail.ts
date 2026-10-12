import { createClient, ensureBrowserSupabaseSession } from './client'
import { getAccountContext } from './account'
import type { Sale } from '@/types'

export type CustomerAccount = {
  id: string; name: string; phone: string; sale_count: number; purchases: number; paid: number; due: number;
  debt_count: number; overdue_count: number; last_purchase: string | null; last_reminder: string | null;
  open_debt_total: number; open_debt_paid: number;
}
export type CustomerAccounts = { customers: CustomerAccount[]; count: number; total_due: number; debtors: number }

export async function getCustomerAccounts(search: string, filter: string, sort: string, offset: number) {
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  const { data, error } = await client.rpc('list_customer_accounts', {
    p_search: search.trim(), p_filter: filter, p_sort: sort, p_offset: offset, p_limit: 30,
  })
  if (error) throw new Error(error.message)
  return data as CustomerAccounts
}

export async function getCustomerSales(customerId: string, offset = 0) {
  const { data, error } = await createClient().from('sales').select('*, items:sale_items(*), payments:sale_payments(*)')
    .eq('customer_id', customerId).order('created_at', { ascending: false }).order('id').range(offset, offset + 19)
  if (error) throw new Error(error.message)
  return (data ?? []) as Sale[]
}

export async function uploadProductImage(image: string) {
  if (!image.startsWith('data:')) return image
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(image)) throw new Error('Format image invalide')
  const blob = await (await fetch(image)).blob()
  if (blob.size > 2 * 1024 * 1024) throw new Error('Image trop volumineuse')
  const { business } = await getAccountContext()
  if (!business?.id) throw new Error('Boutique introuvable')
  const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'
  const client = createClient()
  const path = `${business.id}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('product-images').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
  if (error) throw new Error(error.message)
  return client.storage.from('product-images').getPublicUrl(path).data.publicUrl
}
