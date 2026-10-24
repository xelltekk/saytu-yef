import { beforeEach, expect, it, vi } from 'vitest'
import type { ReportSnapshot } from '@/lib/reports'
const mocks=vi.hoisted(() => ({context:vi.fn(),rpc:vi.fn()}))
vi.mock('./account',() => ({getAccountContext:mocks.context}))
vi.mock('./client',() => ({createClient:() => ({rpc:mocks.rpc}),ensureBrowserSupabaseSession:async () => {}}))
import { getReportsData, getReportProductsForExport } from './reports'
const account={user:{id:'owner'},business:{id:'owner'},member:{role:'admin'}}
const expenses={ownerId:'owner',startDate:'2026-10-01',endExclusive:'2026-11-01',version:'expenses-v1',count:1,total:30000,byCategory:[{category:'rent',total:30000,count:1}],byMonth:[{month:'2026-10',total:30000,count:1}],expenses:[]}
let expenseVersion='expenses-v1'
beforeEach(() => {
  vi.resetAllMocks()
  expenseVersion='expenses-v1'
  mocks.context.mockResolvedValue(account)
  mocks.rpc.mockImplementation((name,args) => Promise.resolve({data:name==='get_expenses_page'
    ? {...expenses,version:expenseVersion}
    : {ownerId:'owner',version:'sales-v1',appliedSellerId:args.p_options.sellerId ?? null,monthlyData:[{key:'2026-10',revenue:100000,profit:50000}],bestMonth:null,
      products:[],totalProducts:0,nextCursor:null},error:null}))
})
const range={preset:'custom' as const,startDate:'2026-10-01',endDate:'2026-10-31'}
it('includes expenses for the owner only, with the same local calendar boundaries as sales',async () => {
  const result=await getReportsData(range)
  expect(result.expenses?.total).toBe(30000)
  expect(result.monthlyData[0].profit-result.expenses!.total).toBe(20000)
  expect(mocks.rpc).toHaveBeenCalledWith('get_expenses_page',{p_options:{startDate:'2026-10-01',endExclusive:'2026-11-01',limit:1}})
})
it.each(['cashier','employee','admin'])('does not read expenses for a delegated %s',async (role) => {
  mocks.context.mockResolvedValue({...account,user:{id:'staff'},member:{role}})
  const result=await getReportsData(range)
  expect(result.expenses).toBeUndefined()
  expect(mocks.rpc.mock.calls.every(([name]) => name!=='get_expenses_page')).toBe(true)
})
it('does not deduct whole-shop expenses from a report filtered to one seller',async () => {
  expect((await getReportsData({...range,sellerId:'seller'})).expenses).toBeUndefined()
  expect(mocks.rpc.mock.calls.every(([name]) => name!=='get_expenses_page')).toBe(true)
})
it('refuses an export after expenses changed, even when the sales version stayed the same',async () => {
  const snapshot=await getReportsData(range)
  expenseVersion='expenses-v2'
  await expect(getReportProductsForExport(snapshot)).rejects.toThrow(/depenses ont change/)
})
it('rechecks expenses after downloading the product pages',async () => {
  const snapshot=await getReportsData(range)
  const implementation=mocks.rpc.getMockImplementation()!
  mocks.rpc.mockImplementation((name,args) => {
    if (name==='get_reports_summary' && args.p_options.mode==='products') expenseVersion='expenses-v2'
    return implementation(name,args)
  })
  await expect(getReportProductsForExport(snapshot)).rejects.toThrow(/depenses ont change/)
})
it('does not treat a missing expense migration as zero operating costs',async () => {
  mocks.rpc.mockResolvedValueOnce({data:{ownerId:'owner',version:'sales-v1',appliedSellerId:null,monthlyData:[],bestMonth:null},error:null})
    .mockResolvedValueOnce({data:null,error:{code:'PGRST202',message:'missing'}})
  await expect(getReportsData(range)).rejects.toThrow(/migration.*Depenses/)
})
it('rejects an invalid seller/expense export scope',async () => {
  const snapshot=await getReportsData(range)
  await expect(getReportProductsForExport({...snapshot,appliedSellerId:'seller'} as ReportSnapshot)).rejects.toThrow(/Perimetre/)
})
