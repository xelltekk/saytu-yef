import { describe,expect,it,vi } from 'vitest'
const fixture = vi.hoisted(() => ({ calls:[] as { table:string; field:string; value:unknown }[],role:'admin' }))
vi.mock('./account',() => ({ getAccountContext:async () => ({ user:{ id:'seller' },member:{ role:fixture.role } }) }))
vi.mock('./client',() => ({ ensureBrowserSupabaseSession:async () => undefined,createClient:() => ({ from:(table:string) => {
  const rows = table === 'sales' ? [{ id:'s1',seller_id:'seller',customer_name:'Client',total:1000,tax:0,amount_paid:1000,amount_due:0,payment_status:'completed',payment_method:'cash',created_at:'2026-10-10T12:00:00Z',items:[{ product_id:'p1',product_name:'Product',quantity:1,unit_price:1000,total:1000,unit_cost:400 }] }]
    : table === 'products' ? [{ id:'p1',name:'Product',buying_price:900,selling_price:1000,quantity:10 }]
      : table === 'sale_payments' ? [{ amount:300,payment_method:'wave',created_at:'2026-10-10T12:00:00Z',sale:{ seller_id:'seller',payment_status:'partial' } }] : [{ id:'seller',full_name:'Seller',email:'fixture@example.invalid',role:'admin' }]
  const chain = { select:() => chain,order:() => chain,in:() => chain,range:() => chain,
    gte:(field:string,value:unknown) => { fixture.calls.push({ table,field,value });return chain },
    lt:(field:string,value:unknown) => { fixture.calls.push({ table,field,value });return chain },
    eq:(field:string,value:unknown) => { fixture.calls.push({ table,field,value });return chain },
    then:(resolve:(value:unknown) => unknown) => Promise.resolve({ data:rows,error:null }).then(resolve) }
  return chain
} }) }))
import { getReportsData } from './queries'
describe('reports payment periods and cost snapshots', () => {
  it('counts actual payment dates separately from the sales cohort and never replaces historical costs', async () => {
    fixture.calls = [];fixture.role = 'admin'
    const report = await getReportsData({ preset:'custom',startDate:'2026-10-01',endDate:'2026-10-31' })
    expect(report.totalCollected).toBe(1000)
    expect(report.cashCollected).toBe(300)
    expect(report.paymentMethodData.find((entry) => entry.method === 'wave')?.collected).toBe(300)
    expect(report.allProducts[0].profit).toBe(600)
    expect(report.estimatedProfitCount).toBe(0)
    expect(fixture.calls.filter((call) => call.table === 'sale_payments' && call.field === 'created_at')).toHaveLength(2)
  })
  it('forces a cashier report and its payments to the authenticated seller', async () => {
    fixture.calls = [];fixture.role = 'cashier'
    await getReportsData({ preset:'custom',startDate:'2026-10-01',endDate:'2026-10-31',sellerId:'another-seller' })
    expect(fixture.calls).toEqual(expect.arrayContaining([{ table:'sales',field:'seller_id',value:'seller' },{ table:'sale_payments',field:'sale.seller_id',value:'seller' }]))
  })
})
