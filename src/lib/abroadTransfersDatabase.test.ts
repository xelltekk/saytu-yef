import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, beforeEach, afterAll, afterEach, expect, it } from 'vitest'

let db: PGlite
const owner = '10000000-0000-0000-0000-000000000001'
const employee = '10000000-0000-0000-0000-000000000002'
const cashier = '10000000-0000-0000-0000-000000000003'
const other = '10000000-0000-0000-0000-000000000004'
const sourceId = '20000000-0000-0000-0000-000000000001'
const legacyId = '20000000-0000-0000-0000-000000000002'
const requestId = '30000000-0000-0000-0000-000000000001'
const nextId = '30000000-0000-0000-0000-000000000002'
const options = { expected_transferred: 0, sku: 'TEST-001', buying_price: 1500, selling_price: 2500 }
type Result = { abroad: { transferred_quantity: number; activated: boolean; inventory_product_id: string }; product: { id: string; quantity: number; selling_price: number; buying_price: number; image_url: string; user_id: string }; transfer: { id: string; quantity: number } }
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, role text, account_owner_id uuid, subscription_plan text DEFAULT 'lifetime');
    INSERT INTO public.profiles(id,role,account_owner_id) VALUES
      ('${owner}','admin','${owner}'),('${employee}','employee','${owner}'),('${cashier}','cashier','${owner}'),('${other}','admin','${other}');
    CREATE FUNCTION public.current_account_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT account_owner_id FROM public.profiles WHERE id=auth.uid()$$;
    CREATE FUNCTION public.can_manage_stock() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT coalesce((SELECT role IN ('admin','employee') FROM public.profiles WHERE id=auth.uid()),false) AND current_setting('test.status',true)='active'$$;
    CREATE TABLE public.categories(id uuid PRIMARY KEY,user_id uuid);
    CREATE TABLE public.products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,name text,sku text,description text,image_url text,category_id uuid,
      buying_price numeric(12,2),selling_price numeric(12,2),quantity integer,min_quantity integer,currency text,status text,
      track_stock boolean DEFAULT true,updated_at timestamptz DEFAULT now());
    CREATE TABLE public.abroad_products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,name text,purchase_price numeric(12,2),quantity integer,
      currency text,notes text,image_url text,synced boolean DEFAULT true,activated boolean DEFAULT false,
      exchange_rate numeric,converted_purchase_price numeric,rate_source text,rate_updated_at timestamptz);
    INSERT INTO public.abroad_products(id,user_id,name,purchase_price,quantity,currency,image_url) VALUES
      ('${sourceId}','${owner}','Telephone',100,10,'CNY','https://example.test/photo.jpg');
    INSERT INTO public.abroad_products(id,user_id,name,quantity,activated) VALUES ('${legacyId}','${owner}','Ancien',5,true);
    CREATE TABLE public.stock_movements(id uuid DEFAULT gen_random_uuid(),user_id uuid,product_id uuid,movement_type text,quantity integer,previous_quantity integer,new_quantity integer,reason text);
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    GRANT SELECT ON public.profiles,public.products TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.abroad_products TO authenticated;
    ALTER TABLE public.abroad_products ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_abroad ON public.abroad_products TO authenticated USING(user_id=public.current_account_id()) WITH CHECK(user_id=public.current_account_id());`)
  await db.exec(readFileSync('supabase/migrations/20261027100635_abroad_partial_transfers.sql', 'utf8'))
}, 60000)
beforeEach(async () => {
  await db.exec('BEGIN; SET LOCAL ROLE authenticated')
  await db.query("SELECT set_config('test.actor',$1,true),set_config('test.status','active',true)", [owner])
})
afterEach(async () => { await db.exec('ROLLBACK') })
afterAll(async () => { await db?.close() })
const transfer = async (quantity: number | null = 4, request = requestId, opts: object = options, source = sourceId) =>
  (await db.query<{ result: Result }>('SELECT public.transfer_abroad_product($1,$2,$3,$4::jsonb) result', [request, source, quantity, JSON.stringify(opts)])).rows[0].result
const admin = async (sql: string) => { await db.exec('RESET ROLE'); await db.exec(sql); await db.exec('SET LOCAL ROLE authenticated') }

it('atomically consumes only the chosen quantity, copies the photo and records a stock movement', async () => {
  const result = await transfer()
  expect(result.abroad).toMatchObject({ transferred_quantity: 4, activated: false, inventory_product_id: result.product.id })
  expect(result.product).toMatchObject({ quantity: 4, user_id: owner, image_url: 'https://example.test/photo.jpg', buying_price: 1500, selling_price: 2500 })
  await db.exec('RESET ROLE')
  expect((await db.query('SELECT quantity,previous_quantity,new_quantity FROM public.stock_movements')).rows).toEqual([{ quantity: 4, previous_quantity: 0, new_quantity: 4 }])
})
it('completes successive shipments on the same product without overwriting its prices or sold quantities', async () => {
  const first = await transfer()
  await admin(`UPDATE public.products SET quantity=1,selling_price=3000 WHERE id='${first.product.id}'`)
  const next = await transfer(6, nextId, { ...options, expected_transferred: 4, selling_price: 1 })
  expect(next.product.id).toBe(first.product.id)
  expect(next.product.quantity).toBe(7)
  expect(Number(next.product.selling_price)).toBe(3000)
  expect(next.abroad).toMatchObject({ transferred_quantity: 10, activated: true })
  expect((await db.query('SELECT * FROM public.products')).rows).toHaveLength(1)
})
it('returns the same receipt for a retry even after the whole purchase was transferred', async () => {
  const first = await transfer(10)
  const retry = await transfer(10)
  expect(retry.transfer.id).toBe(first.transfer.id)
  expect(retry.product.quantity).toBe(10)
  expect((await db.query('SELECT * FROM public.abroad_transfers')).rows).toHaveLength(1)
})
it('refuses reusing an idempotency key with another payload', async () => {
  await transfer()
  await expect(transfer(5)).rejects.toThrow(/autre transfert/)
})
it('rejects a stale request from another tab even with a new request id', async () => {
  await transfer()
  await expect(transfer(4, nextId)).rejects.toThrow(/change/)
})
it.each([0,-1,null,11])('rejects invalid or excessive quantity %s', async (quantity) => {
  await expect(transfer(quantity)).rejects.toThrow(/Quantite|quantite/)
})
it.each([undefined,-1,'NaN','Infinity',1e10,1.111])('rejects invalid price %s', async (price) => {
  await expect(transfer(4, requestId, { ...options, buying_price: price })).rejects.toThrow(/Prix/)
})
it('allows an employee of the same store', async () => {
  await db.query("SELECT set_config('test.actor',$1,true)", [employee])
  expect((await transfer()).product.user_id).toBe(owner)
})
it.each([cashier,other])('rejects unauthorized caller %s', async (actor) => {
  await db.query("SELECT set_config('test.actor',$1,true)", [actor])
  await expect(transfer()).rejects.toThrow(/autorise|introuvable/)
})
it('rejects a suspended store and anonymous calls', async () => {
  await db.query("SELECT set_config('test.status','restricted',true)")
  await expect(transfer()).rejects.toThrow(/autorise/)
})
it('denies anonymous RPC calls', async () => {
  await db.exec('SET LOCAL ROLE anon')
  await expect(transfer()).rejects.toThrow(/permission denied/)
})
it('isolates the transfer ledger from other companies', async () => {
  await transfer()
  await db.query("SELECT set_config('test.actor',$1,true)", [other])
  expect((await db.query('SELECT * FROM public.abroad_transfers')).rows).toEqual([])
})
it('does not grant direct ledger writes or a privileged public endpoint', async () => {
  expect((await db.query<{ allowed: boolean }>("SELECT has_table_privilege('authenticated','public.abroad_transfers','INSERT') allowed")).rows[0].allowed).toBe(false)
  expect((await db.query<{ prosecdef: boolean }>("SELECT prosecdef FROM pg_proc WHERE oid='public.transfer_abroad_product(uuid,uuid,integer,jsonb)'::regprocedure")).rows[0].prosecdef).toBe(false)
})
it('protects the consumed quantity from direct edits', async () => {
  await transfer()
  await expect(db.query('UPDATE public.abroad_products SET transferred_quantity=0 WHERE id=$1', [sourceId])).rejects.toThrow(/Utilisez/)
})
it('rejects direct relinking, including removing a still-existing destination', async () => {
  await transfer()
  await expect(db.query('UPDATE public.abroad_products SET inventory_product_id=NULL WHERE id=$1', [sourceId])).rejects.toThrow(/destination/)
})
it('blocks further transfers if the destination has been deleted', async () => {
  const first = await transfer()
  await admin(`DELETE FROM public.products WHERE id='${first.product.id}'`)
  await expect(transfer(1, nextId, { ...options, expected_transferred: 4 })).rejects.toThrow(/supprimee/)
})
it('rejects an unavailable stock mode for the next shipment', async () => {
  const first = await transfer()
  await admin(`UPDATE public.products SET track_stock=false WHERE id='${first.product.id}'`)
  await expect(transfer(1, nextId, { ...options, expected_transferred: 4 })).rejects.toThrow(/recevoir/)
})
it('refuses reducing the purchase below the transferred quantity', async () => {
  await transfer()
  await expect(db.query('UPDATE public.abroad_products SET quantity=3 WHERE id=$1', [sourceId])).rejects.toThrow(/abroad_transfer_balance/)
})
it('preserves the source in history after a partial transfer', async () => {
  await transfer()
  await expect(db.query('DELETE FROM public.abroad_products WHERE id=$1', [sourceId])).rejects.toThrow(/historique/)
})
it('does not reactivate legacy transfers or fabricate a destination', async () => {
  expect((await db.query('SELECT transferred_quantity,inventory_product_id FROM public.abroad_products WHERE id=$1', [legacyId])).rows[0]).toEqual({ transferred_quantity: 5, inventory_product_id: null })
  await expect(transfer(1, requestId, { ...options, expected_transferred: 5 }, legacyId)).rejects.toThrow(/depasse/)
})
it('checks the product quota for creation but permits replenishing an existing product at the quota', async () => {
  const first = await transfer()
  await admin(`UPDATE public.profiles SET subscription_plan='free' WHERE id='${owner}';
    INSERT INTO public.products(user_id) SELECT '${owner}' FROM generate_series(1,49);`)
  expect((await transfer(1, nextId, { ...options, expected_transferred: 4 })).product.id).toBe(first.product.id)
})
it('blocks creation at the free product quota', async () => {
  await admin(`UPDATE public.profiles SET subscription_plan='free' WHERE id='${owner}';
    INSERT INTO public.products(user_id) SELECT '${owner}' FROM generate_series(1,50);`)
  await expect(transfer()).rejects.toThrow(/plafond/)
})
it('rolls back product creation and source consumption if writing the movement fails', async () => {
  await admin(`CREATE FUNCTION public.fail_movement() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'test movement failure'; END;$$;
    CREATE TRIGGER fail_movement BEFORE INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.fail_movement();`)
  await db.exec('SAVEPOINT before_failure')
  await expect(transfer()).rejects.toThrow(/test movement failure/)
  await db.exec('ROLLBACK TO before_failure')
  expect((await db.query('SELECT * FROM public.products')).rows).toHaveLength(0)
  expect((await db.query('SELECT * FROM public.abroad_transfers')).rows).toHaveLength(0)
  expect((await db.query<{ transferred_quantity: number }>('SELECT transferred_quantity FROM public.abroad_products WHERE id=$1', [sourceId])).rows[0].transferred_quantity).toBe(0)
})
