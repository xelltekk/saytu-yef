import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const owner = '10000000-0000-0000-0000-000000000001'
const cashier = '10000000-0000-0000-0000-000000000002'
const other = '10000000-0000-0000-0000-000000000003'
const product = '20000000-0000-0000-0000-000000000001'
const foreignProduct = '20000000-0000-0000-0000-000000000002'
const supplier = '30000000-0000-0000-0000-000000000001'
let db: PGlite
const sqlFile = (name: string) => readFileSync(resolve('supabase',name),'utf8')
function legacyFunction(file: string, name: string) {
  const sql = sqlFile(`migrations/${file}`)
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  if (start < 0) throw new Error(`Missing fixture function: ${name}`)
  const bodyStart = sql.indexOf('$$',start)
  const bodyEnd = sql.indexOf('$$',bodyStart + 2)
  return sql.slice(start,sql.indexOf(';',bodyEnd) + 1)
}
const salePayload = (quantity = 2) => ({ customer_name:'Test client',customer_phone:'771234567',
  items:[{ product_id:product,product_name:'Test product',quantity,unit_price:1000,total:quantity * 1000 }],
  subtotal:quantity * 1000,discount:quantity * 100,tax:0,total:quantity * 900,due_date:'2026-01-01' })
async function checkout(payload = salePayload(), payments = [{ amount:500,payment_method:'cash' }], id = randomUUID()) {
  return (await db.query<{ id: string; customer_id: string; amount_due: string; payment_status: string }>(
    'select * from public.checkout_sale($1,$2::jsonb,$3::jsonb)',[id,JSON.stringify(payload),JSON.stringify(payments)])).rows[0]
}
async function actor(id: string) { await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false)` ) }
async function stock() { return (await db.query<{ quantity:number }>('select quantity from public.products where id = $1',[product])).rows[0].quantity }

// Cold WASM startup on Windows needs more time than the individual SQL assertions.
beforeAll(async () => {
  db = new PGlite()
  await db.exec(sqlFile('tests/retail.fixture.sql'))
  await db.exec(legacyFunction('202606151612_harden_sales_stock.sql','update_stock_on_sale'))
  await db.exec('CREATE TRIGGER on_sale_item_created AFTER INSERT ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_sale()')
  await db.exec(legacyFunction('202606151612_harden_sales_stock.sql','create_sale_with_items'))
  await db.exec(legacyFunction('202607112130_cash_sessions.sql','create_sale_with_items_v2'))
  await db.exec(legacyFunction('202607112130_cash_sessions.sql','record_sale_payment'))
  await db.exec(legacyFunction('202606211500_team_roles.sql','reverse_sale_with_stock'))
  for (const file of ['20261011000521_retail_reliability.sql','20261011001011_retail_workflows.sql']) {
    try { await db.exec(sqlFile(`migrations/${file}`)) }
    catch (error) {
      const diagnostic = error as { message?: string; where?: string; internalQuery?: string; position?: string }
      const source = sqlFile(`migrations/${file}`)
      const position = Number(diagnostic.position ?? 0)
      throw new Error(`${file}: ${diagnostic.message} ${diagnostic.where ?? ''} ${diagnostic.internalQuery ?? ''} position=${position} context=${source.slice(Math.max(0,position - 400),position + 100)}`)
    }
  }
},90000)
beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE public.profiles CASCADE;
    INSERT INTO public.profiles(id,role,subscription_plan) VALUES('${owner}','admin','lifetime'),('${other}','admin','lifetime');
    INSERT INTO public.profiles(id,role,account_owner_id,subscription_plan) VALUES('${cashier}','cashier','${owner}','free');
    INSERT INTO public.suppliers(id,user_id) VALUES('${supplier}','${owner}');
    INSERT INTO public.products(id,user_id,supplier_id,name,quantity,buying_price,selling_price) VALUES('${product}','${owner}','${supplier}','Test product',10,400,1000);
    INSERT INTO public.products(id,user_id,name,quantity,buying_price,selling_price) VALUES('${foreignProduct}','${other}','Other product',10,400,1000);
    INSERT INTO public.cash_sessions(user_id,member_id) VALUES('${owner}','${owner}'),('${owner}','${cashier}'),('${other}','${other}');`)
  await actor(owner)
})
afterAll(async () => { await db?.close() })

describe('retail PostgreSQL transactions', () => {
  it('stores a large monetary discount with a partial payment without numeric overflow', async () => {
    const payload = { ...salePayload(),subtotal:700000,discount:70000,total:630000,
      items:[{ product_id:product,product_name:'Computer',quantity:2,unit_price:350000,total:700000 }] }
    const sale = await checkout(payload,[{ amount:315000,payment_method:'cash' }])
    expect(Number(sale.amount_due)).toBe(315000)
    expect(sale.payment_status).toBe('partial')
    expect(await stock()).toBe(8)
  })
  it('records an individual payment exactly once and preserves the original method', async () => {
    const sale = await checkout()
    const id = randomUUID()
    const pay = () => db.query('select * from public.record_sale_payment_v2($1,$2,500,\'wave\',null)',[id,sale.id])
    await pay(); await pay()
    const row = (await db.query<{ amount_paid:string; payment_method:string }>('select amount_paid,payment_method from public.sales where id = $1',[sale.id])).rows[0]
    expect(Number(row.amount_paid)).toBe(1000)
    expect(row.payment_method).toBe('cash')
    expect((await db.query('select id from public.sale_payments')).rows).toHaveLength(2)
    await expect(db.query('select public.record_sale_payment_v2($1,$2,600,\'wave\',null)',[id,sale.id])).rejects.toThrow(/autre versement/)
  })
  it('enforces the free quota in PostgreSQL while allowing a retry at the limit', async () => {
    await db.exec(`RESET ROLE; UPDATE public.profiles SET subscription_plan = 'free' WHERE id = '${owner}'`)
    await actor(cashier)
    const id = randomUUID()
    for (let index = 0; index < 9; index++) await checkout(salePayload(1),[])
    const last = await checkout(salePayload(1),[],id)
    expect((await checkout(salePayload(1),[],id)).id).toBe(last.id)
    await expect(checkout(salePayload(1),[])).rejects.toThrow(/10 ventes/)
    expect(await stock()).toBe(0)
  })
  it('rejects a suspended account and access to another account customer', async () => {
    const sale = await checkout()
    await actor(other)
    await expect(db.query('select public.pay_customer_debts($1,$2,100,\'cash\')',[randomUUID(),sale.customer_id])).rejects.toThrow(/introuvable/)
    await db.exec(`RESET ROLE; INSERT INTO public.support_account_controls(account_id,access_status) VALUES('${owner}','suspended')`)
    await actor(owner)
    await expect(checkout()).rejects.toThrow(/suspendu/)
    await expect(db.query('select public.list_customer_accounts()')).rejects.toThrow(/non autorise/)
  })
  it('rolls back an excessive global payment without touching existing debts', async () => {
    const sale = await checkout()
    await expect(db.query('select public.pay_customer_debts($1,$2,2000,\'cash\')',[randomUUID(),sale.customer_id])).rejects.toThrow(/depasse/)
    expect(Number((await db.query<{ amount_due:string }>('select amount_due from public.sales where id = $1',[sale.id])).rows[0].amount_due)).toBe(1300)
    expect((await db.query('select id from public.sale_payments')).rows).toHaveLength(1)
  })
  it('keeps a 75 percent open-debt ratio despite previously paid purchases', async () => {
    await db.exec(`UPDATE public.products SET quantity = 200 WHERE id = '${product}'`)
    await checkout(salePayload(100),[{ amount:90000,payment_method:'cash' }])
    await checkout(salePayload(4),[{ amount:2700,payment_method:'cash' }])
    const result = (await db.query<{ data:{ customers:{ open_debt_total:number; open_debt_paid:number }[] } }>('select public.list_customer_accounts() data')).rows[0].data.customers[0]
    expect(result.open_debt_paid / result.open_debt_total * 100).toBe(75)
  })
  it('limits SaaS metrics to the explicit support operators', async () => {
    await expect(db.query('select public.support_growth_overview()')).rejects.toThrow()
    await db.exec(`RESET ROLE; UPDATE public.profiles SET email = 'contact@xelltekk.com' WHERE id = '${owner}'`)
    await actor(owner)
    expect((await db.query('select public.support_growth_overview()')).rows).toHaveLength(1)
  })
  it('refuses cross-account supplier links on a product', async () => {
    const foreignSupplier = '30000000-0000-0000-0000-000000000002'
    await db.exec(`RESET ROLE; INSERT INTO public.suppliers(id,user_id) VALUES('${foreignSupplier}','${other}')`)
    await actor(owner)
    await expect(db.query('update public.products set supplier_id = $1 where id = $2',[foreignSupplier,product])).rejects.toThrow(/non autorise/)
  })
  it('supports a discount, mixed payments, a debt and retry without a second stock deduction', async () => {
    const id = randomUUID(); const payments = [{ amount:500,payment_method:'cash' },{ amount:300,payment_method:'wave' }]
    const first = await checkout(salePayload(),payments,id)
    expect(Number(first.amount_due)).toBe(1000)
    expect(first.payment_status).toBe('partial')
    expect((await checkout(salePayload(),payments,id)).id).toBe(first.id)
    expect(await stock()).toBe(8)
    expect((await db.query('select * from public.sale_payments')).rows).toHaveLength(2)
    const costs = await db.query<{ unit_cost:string }>('select unit_cost from public.sale_items')
    expect(Number(costs.rows[0].unit_cost)).toBe(400)
    await db.exec(`UPDATE public.products SET buying_price = 900 WHERE id = '${product}'`)
    expect(Number((await db.query<{ unit_cost:string }>('select unit_cost from public.sale_items')).rows[0].unit_cost)).toBe(400)
  })
  it('rolls back every financial write on insufficient stock or foreign products', async () => {
    await expect(checkout(salePayload(11))).rejects.toThrow(/Stock insuffisant/)
    expect(await stock()).toBe(10)
    expect((await db.query('select id from public.sales')).rows).toHaveLength(0)
    const payload = salePayload(); payload.items[0].product_id = foreignProduct
    await expect(checkout(payload)).rejects.toThrow(/indisponible/)
  })
  it('rejects an inconsistent total and anonymous audit writes', async () => {
    await expect(checkout({ ...salePayload(),total:123 })).rejects.toThrow(/Total incoherent/)
    await db.exec('RESET ROLE; SET ROLE anon')
    await expect(db.query('select public.append_subscription_request_audit($1,$2,$3,$4)',[randomUUID(),'fake','test','{}'])).rejects.toThrow(/permission denied/)
  })
  it('allows cashiers to sell under the owner plan but forbids stock and financial edits', async () => {
    await actor(cashier)
    await checkout()
    await db.exec(`UPDATE public.products SET quantity = 90 WHERE id = '${product}'`)
    expect(await stock()).toBe(8)
    await expect(db.exec('UPDATE public.sales SET amount_paid = 0')).rejects.toThrow(/permission denied/)
    await expect(db.query('select public.adjust_product_stock($1,1,false,null)',[product])).rejects.toThrow(/non autorise/)
  })
  it('prevents overselling when two queued checkouts consume the same stock', async () => {
    const results = await Promise.allSettled([checkout(salePayload(6)),checkout(salePayload(6))])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await stock()).toBe(4)
  })
  it('allocates a global payment to multiple debts once and preserves customer continuity', async () => {
    const first = await checkout(salePayload(),[]); await checkout(salePayload(),[])
    const id = randomUUID()
    const pay = () => db.query('select public.pay_customer_debts($1,$2,2500,\'cash\')',[id,first.customer_id])
    await pay(); await pay()
    const accounts = await db.query<{ result: { customers: { due:number; sale_count:number }[] } }>("select public.list_customer_accounts() result")
    expect(accounts.rows[0].result.customers).toHaveLength(1)
    expect(Number(accounts.rows[0].result.customers[0].due)).toBe(1100)
    expect(accounts.rows[0].result.customers[0].sale_count).toBe(2)
  })
  it('restores stock exactly once on a refund', async () => {
    const sale = await checkout()
    await db.query("select public.reverse_sale_with_stock($1,'refunded','Test refund')",[sale.id])
    expect(await stock()).toBe(10)
    await expect(db.query("select public.reverse_sale_with_stock($1,'refunded','Test refund')",[sale.id])).rejects.toThrow(/deja/)
  })
  it('receives an order atomically and cannot receive it twice', async () => {
    const order = await db.query<{ id:string }>('select public.create_purchase_order($1,$2::jsonb,null) id',
      [supplier,JSON.stringify([{ product_id:product,quantity:4,unit_cost:350 }])])
    await db.query("select public.update_purchase_order($1,'received')",[order.rows[0].id])
    await db.query("select public.update_purchase_order($1,'received')",[order.rows[0].id])
    expect(await stock()).toBe(14)
  })
})
