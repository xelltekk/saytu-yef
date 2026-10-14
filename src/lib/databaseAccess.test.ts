import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let db: PGlite
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE FUNCTION public.current_support_email() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$SELECT 'operator'::text$$;
    CREATE FUNCTION public.is_support_operator() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT current_setting('test.operator',true)='yes'$$;
    CREATE FUNCTION public.checkout_sale() RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$SELECT 1$$;
    CREATE FUNCTION public.current_account_id() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT current_setting('test.account',true)::integer$$;
    CREATE FUNCTION public.legacy_payment() RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$SELECT 2$$;
    REVOKE ALL ON FUNCTION public.legacy_payment() FROM PUBLIC;
    CREATE FUNCTION public.database_health() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
    GRANT EXECUTE ON FUNCTION public.database_health() TO anon;
    CREATE TABLE public.support_admins(id integer);
    CREATE TABLE public.subscription_request_audit_logs(id integer);
    CREATE TABLE public.customer_payment_requests(id integer);
    CREATE TABLE public.support_account_controls(id integer);
    CREATE TABLE public.support_tickets(id integer);
    CREATE TABLE public.products(id integer,user_id integer,quantity integer);
    INSERT INTO public.products VALUES(1,1,10),(2,2,20);
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;
    ALTER TABLE public.support_account_controls ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Account members can read products" ON public.products FOR SELECT USING(user_id=public.current_account_id());
    CREATE POLICY "Support operators can manage support account controls" ON public.support_account_controls FOR ALL USING (public.is_support_operator()) WITH CHECK(public.is_support_operator());
    CREATE POLICY "Support operators can read support account controls" ON public.support_account_controls FOR SELECT USING(public.is_support_operator());
    CREATE POLICY "Support operators can manage support tickets" ON public.support_tickets FOR ALL USING(public.is_support_operator()) WITH CHECK(public.is_support_operator());
    CREATE POLICY "Support operators can read support tickets" ON public.support_tickets FOR SELECT USING(public.is_support_operator());
    CREATE FUNCTION public.audit_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN RETURN NEW; END$$;
    CREATE TRIGGER audit_insert BEFORE INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
    INSERT INTO public.support_tickets VALUES(1);`)
  await db.exec(readFileSync(resolve('supabase/migrations/20261013094057_retail_access_hardening.sql'),'utf8'))
  await db.exec(readFileSync(resolve('supabase/migrations/20261013095107_catalog_read_performance.sql'),'utf8'))
},90000)
afterAll(async () => { await db?.close() })

describe('privileged database API', () => {
  it('denies anonymous RPCs but preserves signed-in RPCs and private legacy functions', async () => {
    const result = await db.query<{anon:boolean; signed_in:boolean; legacy:boolean}>(`SELECT
      has_function_privilege('anon','public.checkout_sale()','EXECUTE') AS anon,
      has_function_privilege('authenticated','public.checkout_sale()','EXECUTE') AS signed_in,
      has_function_privilege('authenticated','public.legacy_payment()','EXECUTE') AS legacy`)
    expect(result.rows[0]).toEqual({anon:false,signed_in:true,legacy:false})
  })
  it('keeps the anonymous health probe and removes trigger RPC grants', async () => {
    expect((await db.query<{health:boolean; trigger:boolean}>(`SELECT
      has_function_privilege('anon','public.database_health()','EXECUTE') AS health,
      has_function_privilege('authenticated','public.audit_trigger()','EXECUTE') AS trigger`)).rows[0]).toEqual({health:true,trigger:false})
  })
  it('does not expose a future function by default', async () => {
    await db.exec('CREATE FUNCTION public.future_rpc() RETURNS integer LANGUAGE sql AS $$SELECT 1$$')
    expect((await db.query<{allowed:boolean}>(`SELECT has_function_privilege('anon','public.future_rpc()','EXECUTE') AS allowed`)).rows[0].allowed).toBe(false)
  })
  it('protects internal tables and keeps trigger execution and operator authorization working', async () => {
    try {
      await db.exec(`SET ROLE authenticated; SELECT set_config('test.operator','no',false)`)
      expect((await db.query('SELECT * FROM public.support_tickets')).rows).toHaveLength(0)
      await expect(db.query('SELECT * FROM public.support_admins')).rejects.toThrow(/permission denied/)
      await db.exec(`SELECT set_config('test.operator','yes',false)`)
      await db.exec('INSERT INTO public.support_tickets VALUES(2)')
      expect((await db.query('SELECT * FROM public.support_tickets')).rows).toHaveLength(2)
    } finally { await db.exec('RESET ROLE') }
  })
  it('keeps optimized reads isolated between accounts and recomputes identity per query', async () => {
    try {
      await db.exec(`SET ROLE authenticated; SELECT set_config('test.account','1',false)`)
      expect((await db.query<{id:number}>('SELECT * FROM public.products')).rows.map(row=>row.id)).toEqual([1])
      await db.exec(`SELECT set_config('test.account','2',false)`)
      expect((await db.query<{id:number}>('SELECT * FROM public.products')).rows.map(row=>row.id)).toEqual([2])
    } finally { await db.exec('RESET ROLE') }
  })
})
