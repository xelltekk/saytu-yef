import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { CataloguePage } from './supabase/catalogue'

let db: PGlite
const owner = '10000000-0000-0000-0000-000000000001'
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    CREATE FUNCTION public.current_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.owner',true),'')::uuid$$;
    CREATE FUNCTION public.current_account_access_status() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('test.status',true)$$;
    CREATE TABLE public.categories(id uuid PRIMARY KEY,user_id uuid,name text,color text);
    CREATE TABLE public.suppliers(id uuid PRIMARY KEY,user_id uuid,name text,phone text);
    CREATE TABLE public.products(id uuid PRIMARY KEY,user_id uuid,product_group_id uuid,name text,description text,
      sku text,barcode text,size text,color text,category_id uuid,supplier_id uuid,
      quantity integer,min_quantity integer,buying_price numeric,selling_price numeric,image_url text,
      currency text,status text,created_at timestamptz,updated_at timestamptz);
    CREATE INDEX products_owner_created ON public.products(user_id,created_at);
    CREATE UNIQUE INDEX products_barcode ON public.products(user_id,lower(btrim(barcode)));
    INSERT INTO public.categories VALUES('40000000-0000-0000-0000-000000000001','${owner}','Informatique','blue');
    INSERT INTO public.suppliers VALUES('50000000-0000-0000-0000-000000000001','${owner}','Fournisseur','771234567');
    INSERT INTO public.products SELECT
      ('20000000-0000-0000-'||lpad(shop::text,4,'0')||'-'||lpad(n::text,12,'0'))::uuid,
      ('10000000-0000-0000-0000-'||lpad(shop::text,12,'0'))::uuid,
      ('30000000-0000-0000-'||lpad(shop::text,4,'0')||'-'||lpad(((n+1)/2)::text,12,'0'))::uuid,
      'Produit '||lpad(((n+1)/2)::text,4,'0'), 'Description', 'SKU-'||CASE WHEN n=501 THEN 500 ELSE n END, 'CODE-'||shop||'-'||n,
      CASE WHEN n%2=0 THEN 'XL' ELSE 'S' END, CASE WHEN n%2=0 THEN 'Noir' ELSE 'Blanc' END,
      CASE WHEN shop=1 AND n<=2 THEN '40000000-0000-0000-0000-000000000001'::uuid END,
      CASE WHEN shop=1 AND n<=2 THEN '50000000-0000-0000-0000-000000000001'::uuid END,
      n%10, 2, 1000, 2000, 'data:image/png;base64,test',
      CASE WHEN n=999 THEN 'EUR' ELSE 'XOF' END, CASE WHEN n=998 THEN 'inactive' ELSE 'active' END,
      '2026-01-01'::timestamptz+n*interval '1 minute', '2026-01-01'::timestamptz+n*interval '1 minute'
    FROM generate_series(1,100) shop CROSS JOIN generate_series(1,1000) n;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
    CREATE POLICY products_owner ON public.products FOR SELECT TO authenticated USING(user_id=(SELECT public.current_account_id()));
    CREATE POLICY categories_owner ON public.categories FOR SELECT TO authenticated USING(user_id=(SELECT public.current_account_id()));
    CREATE POLICY suppliers_owner ON public.suppliers FOR SELECT TO authenticated USING(user_id=(SELECT public.current_account_id()));`)
  await db.exec(readFileSync(resolve('supabase/migrations/20261013165734_catalogue_pagination.sql'),'utf8'))
  await db.exec('ALTER TABLE public.products ADD track_stock boolean NOT NULL DEFAULT true, ADD is_available boolean NOT NULL DEFAULT true')
  const restaurant = readFileSync(resolve('supabase/migrations/20261017163255_restaurant_stock_optional.sql'),'utf8')
  await db.exec(restaurant.slice(restaurant.indexOf('-- Catalogue respects'), restaurant.indexOf("NOTIFY pgrst")))
  await db.exec('ANALYZE public.products; SET ROLE authenticated;')
}, 120000)
beforeEach(async () => {
  await db.query("SELECT set_config('test.actor',$1,false),set_config('test.owner',$1,false),set_config('test.status','active',false)",[owner])
})
afterAll(async () => { await db?.close() })

async function page(options: Record<string, unknown> = {}) {
  return (await db.query<{result: CataloguePage}>('SELECT public.list_catalogue_page($1::jsonb) AS result',[JSON.stringify(options)])).rows[0].result
}
describe('100 isolated shops with 1000 variants each', () => {
  it('includes untracked dishes in POS and scanner without counting them in stock or restock', async () => {
    try {
      await db.exec(`RESET ROLE; BEGIN; UPDATE public.products SET track_stock=false,quantity=0 WHERE barcode='CODE-1-1'; SET ROLE authenticated`)
      const result = await page({scope:'pos',group:'30000000-0000-0000-0001-000000000001'})
      expect(result.products.find((p) => p.barcode==='CODE-1-1')).toMatchObject({track_stock:false,quantity:0})
      expect((await page({stock:'untracked'})).totalGroups).toBe(1)
      expect((await page()).summary.units).toBe(4499)
      const lookup = async () => (await db.query<{r:{product:unknown}}>("SELECT public.lookup_catalogue_code('CODE-1-1','pos') r")).rows[0].r.product
      expect(await lookup()).toBeTruthy()
      await db.exec(`RESET ROLE; UPDATE public.products SET is_available=false WHERE barcode='CODE-1-1'; SET ROLE authenticated`)
      expect(await lookup()).toBeNull()
      expect((await page({scope:'pos',group:'30000000-0000-0000-0001-000000000001'})).products).toHaveLength(1)
    } finally { await db.exec('ROLLBACK; SET ROLE authenticated') }
  })
  it('bounds a page to complete groups and preserves global totals', async () => {
    const result = await page()
    expect(result.totalGroups).toBe(500)
    expect(result.totalVariants).toBe(1000)
    expect(result.groupIds).toHaveLength(24)
    expect(result.products).toHaveLength(48)
    expect(new Set(result.products.map((p) => p.user_id))).toEqual(new Set([owner]))
    for (const id of result.groupIds) expect(result.products.filter((p) => p.product_group_id===id)).toHaveLength(2)
    expect(result.summary.units).toBe(4500)
    expect(result.summary.buyingValue).toBe(4500000)
    expect(result.summary.restockUnits).toBe(600)
  })
  it('uses stable pages without duplicates and clamps excessive limits', async () => {
    const first = await page({limit:50}), next = await page({offset:50,limit:500})
    expect(next.limit).toBe(50)
    expect(next.groupIds).toHaveLength(50)
    expect(next.groupIds.some((id) => first.groupIds.includes(id))).toBe(false)
  })
  it('finds an off-page code and returns all siblings, not just the matching variant', async () => {
    const result = await page({group:'30000000-0000-0000-0001-000000000001',search:'CODE-1-1',code:'CODE11'})
    expect(result.products.some((p) => p.barcode==='CODE-1-2')).toBe(true)
    const exact = (await db.query<{result:{ownerId:string;product:{barcode:string}}}>(
      "SELECT public.lookup_catalogue_code(' code-1-1 ','pos') AS result")).rows[0].result
    expect(exact.product.barcode).toBe('CODE-1-1')
    expect(exact.ownerId).toBe(owner)
  })
  it('keeps facets and stock totals global while applying group filters and sorting', async () => {
    const result = await page({category:'40000000-0000-0000-0000-000000000001',sort:'name'})
    expect(result.totalGroups).toBe(1)
    expect(result.products).toHaveLength(2)
    expect(result.summary.variants).toBe(1000)
    expect(result.categories[0].name).toBe('Informatique')
    const other = await page({search:'Produit 0500',code:'produit 0500'})
    expect(other.categories).toHaveLength(1)
    expect(other.suppliers).toHaveLength(1)
  })
  it('allows complete editing by group and thin export without images', async () => {
    const result = await page({group:'30000000-0000-0000-0001-000000000001',images:false})
    expect(result.totalGroups).toBe(1)
    expect(result.products).toHaveLength(2)
    expect(result.products.every((p) => p.image_url===null)).toBe(true)
  })
  it('does not interpret percent as a wildcard, excludes unavailable POS variants', async () => {
    expect((await page({search:'%',code:'%'})).totalGroups).toBe(0)
    const result = await page({scope:'pos'})
    expect(result.totalVariants).toBe(898)
    expect(result.excludedCurrencyCount).toBe(1)
    expect(result.products.every((p) => p.currency==='XOF' && p.quantity>0 && p.status==='active')).toBe(true)
  })
  it('normalizes punctuation consistently and refuses ambiguous SKU references', async () => {
    const result = (await db.query<{result:{product:{barcode:string}}}>(
      "SELECT public.lookup_catalogue_code('CODE11','inventory') AS result")).rows[0].result
    expect(result.product.barcode).toBe('CODE-1-1')
    await expect(db.query("SELECT public.lookup_catalogue_code('SKU-500','inventory')")).rejects.toThrow('Reference ambigue')
  })
  it('keeps cashier account ownership and rejects suspended and anonymous access', async () => {
    await db.query("SELECT set_config('test.actor','60000000-0000-0000-0000-000000000001',false)")
    expect((await page()).ownerId).toBe(owner)
    await db.query("SELECT set_config('test.status','suspended',false)")
    await expect(page()).rejects.toThrow('Acces non autorise')
    const rights = (await db.query<{allowed:boolean}>("SELECT has_function_privilege('anon','public.list_catalogue_page(jsonb)','EXECUTE') AS allowed")).rows[0]
    expect(rights.allowed).toBe(false)
  })
})
