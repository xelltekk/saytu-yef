import { beforeEach, expect, it, vi } from 'vitest'
import type { Expense, ExpenseDraft } from '@/lib/expenses'
const mocks=vi.hoisted(() => ({context:vi.fn(),rpc:vi.fn(),from:vi.fn(),single:vi.fn(),eq:vi.fn(),upload:vi.fn(),download:vi.fn()}))
vi.mock('./account',() => ({getAccountContext:mocks.context}))
vi.mock('./client',() => ({createClient:() => ({rpc:mocks.rpc,from:mocks.from,storage:{from:() => ({upload:mocks.upload,download:mocks.download})}}),ensureBrowserSupabaseSession:async () => {}}))
import { getExpensesPage, saveExpense, voidExpense, downloadExpenseReceipt, uploadExpenseReceipt } from './expenses'
const owner='10000000-0000-0000-0000-000000000001'
const id='20000000-0000-0000-0000-000000000001'
const account={user:{id:owner},business:{id:owner},member:{role:'admin'}}
const draft:ExpenseDraft={label:'Loyer',category:'rent',amount:100000,expense_date:'2026-10-01',payment_method:'cash',notes:'',receipt_path:null}
const expense={...draft,id,user_id:owner,revision:1,voided_at:null} as Expense
beforeEach(() => {
  vi.resetAllMocks()
  mocks.context.mockResolvedValue(account)
  const query={select:vi.fn().mockReturnThis(),insert:vi.fn().mockReturnThis(),update:vi.fn().mockReturnThis(),eq:mocks.eq,is:vi.fn().mockReturnThis(),maybeSingle:mocks.single}
  mocks.eq.mockReturnValue(query)
  mocks.from.mockReturnValue(query)
  mocks.single.mockResolvedValue({data:expense,error:null})
  mocks.rpc.mockResolvedValue({data:{ownerId:owner,total:100000,byCategory:[],byMonth:[]},error:null})
  mocks.upload.mockResolvedValue({error:null})
  mocks.download.mockResolvedValue({data:new Blob(['test'],{type:'image/jpeg'}),error:null})
})
it.each(['admin','employee','cashier'])('refuses delegated %s before querying any private table or storage',async (role) => {
  mocks.context.mockResolvedValue({...account,user:{id:'staff'},member:{role}})
  await expect(getExpensesPage({startDate:'2026-10-01',endExclusive:'2026-11-01'})).rejects.toThrow(/proprietaire/)
  await expect(downloadExpenseReceipt(`${owner}/${id}.jpg`)).rejects.toThrow(/proprietaire/)
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect(mocks.download).not.toHaveBeenCalled()
})
it('rejects a stale response after changing accounts instead of exposing former owner data',async () => {
  mocks.context.mockResolvedValueOnce(account).mockResolvedValue({...account,user:{id:'new'},business:{id:'new'}})
  await expect(getExpensesPage({startDate:'2026-10-01',endExclusive:'2026-11-01'})).rejects.toThrow(/Session modifiee/)
})
it('only saves validated fields with a stable id and reconciles an identical committed retry',async () => {
  mocks.single.mockResolvedValueOnce({data:null,error:{code:'23505',message:'duplicate'}}).mockResolvedValueOnce({data:expense,error:null})
  expect((await saveExpense(id,draft)).id).toBe(id)
  expect(mocks.eq).toHaveBeenCalledWith('user_id',owner)
  mocks.single.mockResolvedValueOnce({data:null,error:{code:'23505',message:'duplicate'}}).mockResolvedValueOnce({data:{...expense,amount:900},error:null})
  await expect(saveExpense(id,draft)).rejects.toThrow(/differentes/)
})
it('uses the stored revision on edits and cancellations and surfaces conflicts',async () => {
  await saveExpense(id,{...draft,amount:120000},expense)
  expect(mocks.eq).toHaveBeenCalledWith('revision',1)
  mocks.single.mockResolvedValue({data:null,error:null})
  await expect(voidExpense(expense)).rejects.toThrow(/change/)
})
it('rejects invalid amounts before upload/save and private files from another folder',async () => {
  await expect(saveExpense(id,{...draft,amount:1.5})).rejects.toThrow(/entier/)
  expect(mocks.from).not.toHaveBeenCalled()
  await expect(downloadExpenseReceipt(`other/${id}.jpg`)).rejects.toThrow(/invalide/)
  expect(mocks.download).not.toHaveBeenCalled()
})
it('uses authenticated binary downloads, never a public URL, and stable upload paths',async () => {
  expect((await downloadExpenseReceipt(`${owner}/${id}.jpg`)).type).toBe('image/jpeg')
  expect(await uploadExpenseReceipt(new Blob(['test'],{type:'image/jpeg'}),id)).toBe(`${owner}/${id}.jpg`)
  expect(mocks.upload.mock.calls[0][2].upsert).toBe(true)
})
