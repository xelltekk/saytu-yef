import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import type { ReportSnapshot, ReportProduct } from './reports'

let db: PGlite
const owner='10000000-0000-0000-0000-000000000001'
const other='10000000-0000-0000-0000-000000000002'
const yearly='10000000-0000-0000-0000-000000000003'
const cashier='10000000-0000-0000-0000-000000000101'
const cashier2='10000000-0000-0000-0000-000000000102'
const id=(prefix:string,n:number) => `${prefix}0000000-0000-0000-0000-${String(n).padStart(12,'0')}`
type Result = ReportSnapshot & {monthlyData:Array<{key:string;revenue:number;profit:number}>;products:ReportProduct[];totalProducts:number;nextCursor:{id:string;revenue:string}}
beforeAll(async () => {
  db=new PGlite()
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    CREATE FUNCTION public.current_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT current_setting('test.owner',true)::uuid$$;
    CREATE FUNCTION public.current_account_access_status() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('test.status',true)$$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,account_owner_id uuid,role text,email text,full_name text);
    CREATE TABLE public.products(id uuid PRIMARY KEY,user_id uuid,buying_price numeric);
    CREATE TABLE public.sales(id uuid PRIMARY KEY,user_id uuid,seller_id uuid,customer_name text,customer_phone text,total numeric,tax numeric,amount_paid numeric,amount_due numeric,payment_status text,payment_method text,created_at timestamptz);
    CREATE TABLE public.sale_items(id uuid PRIMARY KEY,sale_id uuid,product_id uuid,product_name text,quantity integer,total numeric,unit_cost numeric);
    CREATE TABLE public.sale_payments(id uuid PRIMARY KEY,user_id uuid,sale_id uuid,amount numeric,payment_method text,created_at timestamptz);
    CREATE INDEX sales_owner_date ON public.sales(user_id,created_at);
    CREATE INDEX items_sale ON public.sale_items(sale_id);
    CREATE INDEX payments_owner_date ON public.sale_payments(user_id,created_at);
    INSERT INTO public.profiles VALUES('${owner}','${owner}','admin','owner@test.invalid','Proprietaire'),
      ('${other}','${other}','admin','other@test.invalid','AUTRE BOUTIQUE'),('${yearly}','${yearly}','admin','annual@test.invalid','Annuel'),
      ('${cashier}','${owner}','cashier','cashier@test.invalid','Caissier A'),('${cashier2}','${owner}','cashier','cashier2@test.invalid','Caissier B');
    INSERT INTO public.products VALUES('${id('2',1)}','${owner}',9999),('${id('2',2)}','${owner}',2000),('${id('2',3)}','${owner}',0),('${id('2',4)}','${yearly}',9999),('${id('2',5)}','${other}',500000);
    INSERT INTO public.sales VALUES
      ('${id('3',1)}','${owner}','${cashier}','Alice','771234567',9000,0,7000,2000,'partial','wave','2026-07-01T12:00Z'),
      ('${id('3',2)}','${owner}','${cashier2}','Ben','772345678',11800,1800,11800,0,'completed','cash','2026-07-02T12:00Z'),
      ('${id('3',3)}','${owner}','${cashier}','Dette ancienne','',5000,0,2500,2500,'partial','cash','2026-06-25T12:00Z'),
      ('${id('3',4)}','${owner}','${cashier}','Annule','',7777,0,0,7777,'cancelled','cash','2026-07-03T12:00Z'),
      ('${id('3',5)}','${owner}','${cashier}','Rembourse','',8888,0,8888,0,'refunded','cash','2026-07-03T12:00Z'),
      ('${id('3',6)}','${other}','${other}','SECRET AUTRE BOUTIQUE','',1000000,0,1000000,0,'completed','cash','2026-07-01T12:00Z'),
      ('${id('3',7)}','${owner}',NULL,'Orphelin','',1000,0,1000,0,'completed','cash','2026-07-04T12:00Z'),
      ('${id('3',8)}','${owner}','${cashier}','ALICE','771234567',2000,0,NULL,NULL,'completed','cash','2026-07-05T12:00Z'),
      ('${id('3',9)}','${owner}','${cashier}','Minuit','',1200,0,1200,0,'completed','cash','2026-09-30T23:30Z');
    INSERT INTO public.sale_items VALUES
      ('${id('4',1)}','${id('3',1)}','${id('2',1)}','Produit historique',1,6000,1000),
      ('${id('4',2)}','${id('3',1)}','${id('2',2)}','Cout ancien estime',2,4000,NULL),
      ('${id('4',3)}','${id('3',2)}','${id('2',1)}','Produit renomme',2,10000,1000),
      ('${id('4',6)}','${id('3',6)}','${id('2',5)}','SECRET ITEM OTHER SHOP',1,1000000,500000),
      ('${id('4',7)}','${id('3',7)}',NULL,'Produit supprime',1,1000,NULL),
      ('${id('4',8)}','${id('3',8)}','${id('2',3)}','Cout nul',1,2000,0),
      ('${id('4',9)}','${id('3',9)}','${id('2',3)}','Cout nul',1,1200,0);
    INSERT INTO public.sale_payments VALUES
      ('${id('5',1)}','${owner}','${id('3',1)}',4000,'wave','2026-07-01T12:00Z'),
      ('${id('5',2)}','${owner}','${id('3',2)}',11800,'cash','2026-07-02T12:00Z'),
      ('${id('5',3)}','${owner}','${id('3',3)}',1000,'wave','2026-07-05T12:00Z'),
      ('${id('5',4)}','${owner}','${id('3',4)}',666,'cash','2026-07-03T12:00Z'),
      ('${id('5',5)}','${owner}','${id('3',5)}',8888,'cash','2026-07-03T12:00Z'),
      ('${id('5',6)}','${other}','${id('3',6)}',1000000,'cash','2026-07-01T12:00Z'),
      ('${id('5',7)}','${owner}','${id('3',7)}',1000,'cash','2026-07-04T12:00Z'),
      ('${id('5',8)}','${owner}','${id('3',8)}',2000,'cash','2026-07-05T12:00Z'),
      ('${id('5',10)}','${owner}','${id('3',1)}',3000,'card','2026-08-01T12:00Z');
    INSERT INTO public.sales SELECT ('60000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'${yearly}','${yearly}',
      'Client annuel','',100,0,100,0,'completed','cash',
      '2025-01-01T00:00Z'::timestamptz+((n-1)/50)*interval '1 day'+(n%50)*interval '10 minutes' FROM generate_series(1,18250) n;
    INSERT INTO public.sale_items SELECT ('70000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
      ('60000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'${id('2',4)}','Produit annuel',1,100,50 FROM generate_series(1,18250) n;
    INSERT INTO public.sale_payments SELECT ('80000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
      '${yearly}',s.id,100,'cash',s.created_at FROM public.sales s JOIN generate_series(1,18250) n ON s.id=('60000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_profiles ON public.profiles TO authenticated USING(coalesce(account_owner_id,id)=(SELECT public.current_account_id()));
    CREATE POLICY own_products ON public.products TO authenticated USING(user_id=(SELECT public.current_account_id()));
    CREATE POLICY own_sales ON public.sales TO authenticated USING(user_id=(SELECT public.current_account_id()));
    CREATE POLICY own_payments ON public.sale_payments TO authenticated USING(user_id=(SELECT public.current_account_id()));
    CREATE POLICY "Account members can read sale items" ON public.sale_items FOR SELECT TO authenticated
      USING(EXISTS(SELECT 1 FROM public.sales s WHERE s.id=sale_id AND s.user_id=public.current_account_id()));
    ANALYZE public.sales; ANALYZE public.sale_items; ANALYZE public.sale_payments;`)
  await db.exec(readFileSync(resolve('supabase/migrations/20261013200735_rapports_agreges.sql'),'utf8'))
  await db.exec(readFileSync(resolve('supabase/migrations/20261014133001_sale_items_read_policy_performance.sql'),'utf8'))
},120000)
beforeEach(async () => {
  await db.exec('BEGIN; SET LOCAL ROLE authenticated;')
  await db.query("SELECT set_config('test.owner',$1,true),set_config('test.actor',$1,true),set_config('test.status','active',true)",[owner])
})
afterEach(async () => { await db.exec('ROLLBACK') })
afterAll(async () => { await db?.close() })
async function report(options:Record<string,unknown>={}) {
  return (await db.query<{r:Result}>('SELECT public.get_reports_summary($1::jsonb) r',[JSON.stringify({start:'2026-07-01T00:00Z',endExclusive:'2026-08-01T00:00Z',granularity:'day',timeZone:'UTC',...options})])).rows[0].r
}
it('preserves discounted revenue, tax, snapshot costs, nullable legacy balances and estimated deleted costs',async () => {
  const r=await report()
  expect(r).toMatchObject({salesCount:4,totalInvoiced:23800,totalCollected:21800,totalDue:2000,totalSold:7,estimatedProfitCount:2,completedCount:3,partialCount:1,pendingCount:0})
  expect(r.monthlyData.reduce((sum,p) => sum+p.revenue,0)).toBe(22000)
  expect(r.monthlyData.reduce((sum,p) => sum+p.profit,0)).toBe(14000)
  expect(r.avgMargin).toBeCloseTo(14000/22000*100)
  expect(r.topProducts[0]).toMatchObject({name:'Produit historique',sold:3,revenue:15400,profit:12400})
  expect(r.bestProductByProfit?.id).toBe(id('2',1))
  expect(r.highestDueClient).toMatchObject({name:'Alice',invoiced:11000,due:2000})
})
it('uses actual receipt dates, including older debts and excluding future payments and reversed sales',async () => {
  const r=await report()
  expect(r.cashCollected).toBe(19800)
  expect(r.paymentMethodData.find((m)=>m.method==='wave')).toMatchObject({count:1,invoiced:9000,collected:5000,due:2000})
  expect(r.paymentMethodData.find((m)=>m.method==='card')?.collected).toBe(0)
  expect(JSON.stringify(r)).not.toContain('SECRET AUTRE BOUTIQUE')
  expect(r.sellerOptions).toHaveLength(3)
})
it('forces cashier scope even if a caller spoofs another seller',async () => {
  await db.query("SELECT set_config('test.actor',$1,true)",[cashier])
  const r=await report({sellerId:cashier2})
  expect(r.appliedSellerId).toBe(cashier)
  expect(r.salesCount).toBe(2)
  expect(r.totalInvoiced).toBe(11000)
  expect(r.cashCollected).toBe(7000)
  expect(r.sellerOptions.map((s)=>s.id)).toEqual([cashier])
  expect(r.sellerBreakdown).toHaveLength(1)
})
it('keeps optimized parent-sale reads isolated and recomputes the account on each statement',async () => {
  expect((await db.query(`SELECT id FROM public.sale_items WHERE sale_id='${id('3',1)}'`)).rows).toHaveLength(2)
  expect((await db.query(`SELECT id FROM public.sale_items WHERE sale_id='${id('3',6)}'`)).rows).toHaveLength(0)
  await db.query("SELECT set_config('test.owner',$1,true),set_config('test.actor',$1,true)",[other])
  expect((await db.query(`SELECT id FROM public.sale_items WHERE sale_id='${id('3',6)}'`)).rows).toHaveLength(1)
  expect((await db.query(`SELECT id FROM public.sale_items WHERE sale_id='${id('3',1)}'`)).rows).toHaveLength(0)
})
it('filters owners by seller without changing the receipt-date convention',async () => {
  const r=await report({sellerId:cashier2})
  expect(r).toMatchObject({salesCount:1,totalSold:2,totalInvoiced:11800,cashCollected:11800})
})
it('fills empty periods and obeys local timezone boundaries',async () => {
  const r=await report({start:'2026-09-30T22:00Z',endExclusive:'2026-10-01T22:00Z',timeZone:'Europe/Paris'})
  expect(r.monthlyData).toEqual([{key:'2026-10-01',revenue:1200,profit:1200}])
  const empty=await report({start:'2026-09-29T22:00Z',endExclusive:'2026-09-30T22:00Z',timeZone:'Europe/Paris'})
  expect(empty.salesCount).toBe(0)
  expect(empty.monthlyData).toEqual([{key:'2026-09-30',revenue:0,profit:0}])
  expect(empty.bestMonth).toBeNull()
  expect(empty.avgMargin).toBe(0)
})
it('returns keyset-paged aggregate products, with a version changed by relevant financial updates',async () => {
  const r=await report(),first=await report({mode:'products',limit:2})
  expect(first.version).toBe(r.version)
  expect(first.products).toHaveLength(2)
  const next=await report({mode:'products',limit:2,after:first.nextCursor})
  expect(next.products).toHaveLength(2)
  expect(next.products.some((p)=>first.products.some((previous)=>previous.id===p.id))).toBe(false)
  await db.exec(`RESET ROLE; UPDATE public.sales SET amount_paid=8000,amount_due=1000 WHERE id='${id('3',1)}'; SET LOCAL ROLE authenticated;`)
  expect((await report()).version).not.toBe(r.version)
})
it('summarizes 18250 annual sales without shipping sale rows or historical items',async () => {
  await db.query("SELECT set_config('test.actor',$1,true),set_config('test.owner',$1,true)",[yearly])
  const r=await report({start:'2025-01-01T00:00Z',endExclusive:'2026-01-01T00:00Z',granularity:'month'})
  expect(r).toMatchObject({salesCount:18250,totalSold:18250,totalInvoiced:1825000,cashCollected:1825000})
  expect(r.monthlyData).toHaveLength(12)
  expect(r.monthlyData.reduce((sum,p)=>sum+p.profit,0)).toBe(912500)
  expect(JSON.stringify(r).length).toBeLessThan(15000)
  expect(r).not.toHaveProperty('allProducts')
})
it('denies anonymous, inactive accounts and unauthorized seller selection',async () => {
  expect((await db.query<{allowed:boolean}>("SELECT has_function_privilege('anon','public.get_reports_summary(jsonb)','EXECUTE') allowed")).rows[0].allowed).toBe(false)
  await expect(report({sellerId:other})).rejects.toThrow('Vendeur invalide')
})
it('rejects suspended accounts',async () => {
  await db.query("SELECT set_config('test.status','suspended',true)")
  await expect(report()).rejects.toThrow('Acces non autorise')
})
it('preserves exact decimal cursors for tax/discount allocation without repeating products',async () => {
  await db.exec(`RESET ROLE;
    INSERT INTO public.sales VALUES('${id('3',10)}','${owner}','${owner}','','',100,0,100,0,'completed','cash','2026-11-01T12:00Z');
    INSERT INTO public.sale_items SELECT ('90000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
      '${id('3',10)}',('20000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Fraction '||n,1,100,0 FROM generate_series(1,3) n;
    SET LOCAL ROLE authenticated;`)
  const options={start:'2026-11-01T00:00Z',endExclusive:'2026-12-01T00:00Z',mode:'products',limit:1}
  const first=await report(options),second=await report({...options,after:first.nextCursor}),third=await report({...options,after:second.nextCursor})
  expect(new Set([first.products[0].id,second.products[0].id,third.products[0].id]).size).toBe(3)
  expect(typeof first.nextCursor.revenue).toBe('string')
})
