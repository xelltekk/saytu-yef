import { getAccountContext } from './account'
import { createClient, ensureBrowserSupabaseSession } from './client'
import { isBusinessOwner, validateExpense, type Expense, type ExpenseDraft, type ExpenseOptions, type ExpensePage, type ExpenseSummary } from '@/lib/expenses'

async function ownerContext() {
  const account = await getAccountContext()
  if (!isBusinessOwner(account.user.id,account.business?.id,account.member?.role)) throw new Error('Acces reserve au proprietaire.')
  return account
}
async function verifyOwner(actorId: string) {
  const current = await ownerContext()
  if (current.user.id !== actorId) throw new Error('Session modifiee, veuillez reessayer.')
}
function check(error: { code?: string; message: string } | null) {
  if (!error) return
  if (['42P01','42883','PGRST202','PGRST205'].includes(error.code ?? '')) throw new Error('La migration du module Depenses doit etre appliquee dans Supabase.')
  throw new Error(error.message)
}
export async function getExpensesPage(options: ExpenseOptions, signal?: AbortSignal): Promise<ExpensePage> {
  const account = await ownerContext()
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  const request = client.rpc('get_expenses_page',{ p_options: options })
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  check(error)
  await verifyOwner(account.user.id)
  if (data?.ownerId !== account.user.id) throw new Error('Boutique du rapport de depenses invalide.')
  const result = data as ExpensePage
  if (![result.total,...result.byCategory.map((item) => item.total),...result.byMonth.map((item) => item.total)].every(Number.isSafeInteger)) throw new Error('Montants trop eleves pour ce rapport.')
  return result
}
export async function saveExpense(id: string, draft: ExpenseDraft, previous?: Expense) {
  validateExpense(draft)
  const account = await ownerContext()
  if (draft.receipt_path && !new RegExp(`^${account.user.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(draft.receipt_path)) throw new Error('Justificatif invalide.')
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  const payload = { ...draft, label: draft.label.trim(), notes: draft.notes.trim() }
  const result = previous
    ? await client.from('expenses').update(payload).eq('user_id',account.user.id).eq('id',id).eq('revision',previous.revision).is('voided_at',null).select('*').maybeSingle()
    : await client.from('expenses').insert({ ...payload,id,user_id: account.user.id }).select('*').maybeSingle()
  // A network retry may encounter the row already committed with this stable id.
  if (result.error?.code === '23505' && !previous) {
    const existing = await client.from('expenses').select('*').eq('id',id).eq('user_id',account.user.id).maybeSingle()
    check(existing.error)
    await verifyOwner(account.user.id)
    if (existing.data && !existing.data.voided_at && Object.entries(payload).every(([key,value]) => existing.data[key] === value)) return existing.data as Expense
    throw new Error('Cette depense a deja ete enregistree avec des informations differentes. Actualisez la liste.')
  }
  check(result.error)
  await verifyOwner(account.user.id)
  if (!result.data) throw new Error('Cette depense a change. Actualisez la liste avant de la modifier.')
  return result.data as Expense
}
export async function voidExpense(expense: Expense) {
  const account = await ownerContext()
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  const { data,error } = await client.from('expenses').update({ voided_at:new Date().toISOString() })
    .eq('user_id',account.user.id).eq('id',expense.id).eq('revision',expense.revision).is('voided_at',null).select('id').maybeSingle()
  check(error)
  await verifyOwner(account.user.id)
  if (!data) throw new Error('Cette depense a change ou est deja annulee. Actualisez la liste.')
}
export async function uploadExpenseReceipt(blob: Blob, receiptId: string) {
  const account = await ownerContext()
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  if (blob.type !== 'image/jpeg' || blob.size > 5*1024*1024 || !/^[0-9a-f-]{36}$/.test(receiptId)) throw new Error('Photo invalide.')
  const path = `${account.user.id}/${receiptId}.jpg`
  const { error } = await client.storage.from('expense-receipts').upload(path,blob,{ contentType:'image/jpeg',upsert:true,cacheControl:'0' })
  check(error)
  await verifyOwner(account.user.id)
  return path
}
export async function downloadExpenseReceipt(path: string) {
  const account = await ownerContext()
  if (!new RegExp(`^${account.user.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)) throw new Error('Justificatif invalide.')
  const client = createClient()
  await ensureBrowserSupabaseSession(client)
  const { data,error } = await client.storage.from('expense-receipts').download(path)
  check(error)
  await verifyOwner(account.user.id)
  if (!data || !['image/jpeg','image/png','image/webp'].includes(data.type) || data.size > 5*1024*1024) throw new Error('Justificatif indisponible.')
  return data
}
export async function verifyExpenseSummary(summary: ExpenseSummary, signal?: AbortSignal) {
  const current = await getExpensesPage({ startDate:summary.startDate,endExclusive:summary.endExclusive,limit:1 },signal)
  if (current.ownerId !== summary.ownerId || current.version !== summary.version) throw new Error('Les depenses ont change. Actualisez le rapport avant de relancer l\'export.')
}
