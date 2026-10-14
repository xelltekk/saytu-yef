import { beforeEach,expect,it,vi } from 'vitest'
const fixture = vi.hoisted(() => ({rpc:vi.fn(),context:vi.fn(),role:'admin'}))
vi.mock('./account',() => ({ getAccountContext:fixture.context }))
vi.mock('./client',() => ({ ensureBrowserSupabaseSession:async () => {},createClient:() => ({rpc:fixture.rpc,
  from:() => {throw new Error('A report must not download raw tables')} }) }))
import { getReportsData } from './queries'
import { getReportProductsForExport } from './reports'

const range={preset:'custom' as const,startDate:'2026-10-01',endDate:'2026-10-31'}
const raw=() => ({ownerId:'owner',version:'v1',appliedSellerId:fixture.role==='cashier'?'seller':null,
  monthlyData:[{key:'2026-10-10',revenue:1000,profit:600}],bestMonth:{key:'2026-10-10',revenue:1000,profit:600},
  topProducts:[{id:'p1',name:'Product',sold:1,revenue:1000,profit:600,margin:60}],totalCollected:1000,cashCollected:300,
  paymentMethodData:[{method:'wave',collected:300}],estimatedProfitCount:0})
beforeEach(() => {
  fixture.role='admin';fixture.rpc.mockReset();fixture.context.mockReset()
  fixture.context.mockImplementation(async () => ({user:{id:'seller'},business:{id:'owner'},member:{role:fixture.role}}))
  fixture.rpc.mockImplementation(() => Promise.resolve({data:raw(),error:null}))
})
it('uses only the aggregate RPC, preserves payment indicators and labels local buckets',async () => {
  const r=await getReportsData(range)
  expect(r.totalCollected).toBe(1000);expect(r.cashCollected).toBe(300)
  expect(r.topProducts[0].profit).toBe(600)
  expect(r.monthlyData[0]).toMatchObject({revenue:1000,profit:600})
  expect(r.monthlyData[0].month).not.toBe('2026-10-10')
  expect(r).not.toHaveProperty('allProducts')
  expect(fixture.rpc).toHaveBeenCalledWith('get_reports_summary',{p_options:expect.objectContaining({
    start:r.request.start,endExclusive:r.request.endExclusive,granularity:'day',timeZone:expect.any(String),sellerId:null})})
})
it('forces a cashier request to its own seller in addition to server-side enforcement',async () => {
  fixture.role='cashier'
  const r=await getReportsData({...range,sellerId:'another-seller'})
  expect(r.appliedSellerId).toBe('seller')
  expect(fixture.rpc.mock.calls[0][1].p_options.sellerId).toBe('seller')
})
it('exports all product aggregates by cursor with the original report snapshot',async () => {
  const snapshot=await getReportsData(range)
  const products=Array.from({length:123},(_,i) => ({id:`p${i}`,name:`Product ${i}`,sold:1,revenue:100000-i,profit:100,margin:1}))
  fixture.rpc.mockImplementation((_name,args) => {
    const offset=args.p_options.after ? products.findIndex((p) => p.id===args.p_options.after.id)+1 : 0
    const rows=products.slice(offset,offset+50),last=rows.at(-1)
    return Promise.resolve({data:{ownerId:'owner',version:'v1',appliedSellerId:null,products:rows,totalProducts:123,
      nextCursor:last ? {id:last.id,revenue:String(last.revenue)} : null},error:null})
  })
  expect(await getReportProductsForExport(snapshot)).toHaveLength(123)
  expect(fixture.rpc.mock.calls.slice(1).map((call)=>call[1].p_options.after?.id)).toEqual([undefined,'p49','p99'])
})
it('refuses a mixed export if financial data changed after the summary',async () => {
  const snapshot=await getReportsData(range)
  fixture.rpc.mockResolvedValue({data:{ownerId:'owner',version:'v2',appliedSellerId:null,products:[],totalProducts:0},error:null})
  await expect(getReportProductsForExport(snapshot)).rejects.toThrow(/Actualisez/)
})
it('does not apply a stale response after a role or shop change',async () => {
  fixture.context.mockResolvedValueOnce({user:{id:'seller'},business:{id:'owner'},member:{role:'admin'}})
    .mockResolvedValueOnce({user:{id:'seller'},business:{id:'owner'},member:{role:'cashier'}})
  await expect(getReportsData(range)).rejects.toThrow(/Session modifiee/)
})
it('fails closed when the migration is missing instead of loading the entire history',async () => {
  fixture.rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'missing'}})
  await expect(getReportsData(range)).rejects.toThrow(/migration/)
  expect(fixture.rpc).toHaveBeenCalledTimes(1)
})
it('rejects a cashier response scoped to another seller',async () => {
  fixture.role='cashier'
  fixture.rpc.mockResolvedValue({data:{...raw(),appliedSellerId:'other'},error:null})
  await expect(getReportsData(range)).rejects.toThrow(/Session modifiee/)
})
