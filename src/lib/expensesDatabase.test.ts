import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import type { ExpensePage } from './expenses'

let db: PGlite
const owner='10000000-0000-0000-0000-000000000001'
const other='10000000-0000-0000-0000-000000000002'
const staff='10000000-0000-0000-0000-000000000003'
const first='20000000-0000-0000-0000-000000000001'
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    CREATE FUNCTION public.current_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.owner',true),'')::uuid$$;
    CREATE FUNCTION public.is_account_admin() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('test.role',true)='admin'$$;
    CREATE FUNCTION public.current_account_access_status() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('test.status',true)$$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY); INSERT INTO public.profiles VALUES('${owner}'),('${other}'),('${staff}');
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$SELECT string_to_array(name,'/')$$;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;
    GRANT SELECT,INSERT,UPDATE ON storage.objects TO authenticated;
    GRANT SELECT ON storage.buckets TO authenticated;`)
  await db.exec(readFileSync('supabase/migrations/20261024172941_owner_expenses.sql','utf8'))
  await db.exec(`INSERT INTO public.expenses(id,user_id,label,category,amount,expense_date,payment_method) VALUES
    ('${first}','${owner}','Loyer','rent',100000,'2026-10-01','cash'),
    ('20000000-0000-0000-0000-000000000002','${owner}','Internet','utilities',15000,'2026-10-31','wave'),
    ('20000000-0000-0000-0000-000000000003','${owner}','Hors periode','transport',5000,'2026-11-01','cash'),
    ('20000000-0000-0000-0000-000000000004','${other}','PRIVE AUTRE BOUTIQUE','wages',900000,'2026-10-01','cash');
    INSERT INTO storage.objects(bucket_id,name) VALUES('expense-receipts','${owner}/${first}.jpg'),('expense-receipts','${other}/${first}.jpg');`)
},60000)
beforeEach(async () => {
  await db.exec('BEGIN; SET LOCAL ROLE authenticated')
  await db.query("SELECT set_config('test.actor',$1,true),set_config('test.owner',$1,true),set_config('test.role','admin',true),set_config('test.status','active',true)",[owner])
})
afterEach(async () => { await db.exec('ROLLBACK') })
afterAll(async () => { await db?.close() })
const page = async (options: Record<string,unknown> = {}) => (await db.query<{r:ExpensePage}>("SELECT public.get_expenses_page($1::jsonb) r",[JSON.stringify({startDate:'2026-10-01',endExclusive:'2026-11-01',...options})])).rows[0].r

it('aggregates exact inclusive/exclusive dates, categories and months without other shops',async () => {
  const result = await page()
  expect(result.count).toBe(2)
  expect(result.total).toBe(115000)
  expect(result.byMonth).toEqual([{month:'2026-10',total:115000,count:2}])
  expect(result.expenses.map((item) => item.label)).toEqual(['Internet','Loyer'])
  expect((await page({category:'rent'})).total).toBe(100000)
})
it('returns a bounded page with complete totals, even beyond the first page', async () => {
  await db.exec(`INSERT INTO public.expenses(user_id,label,category,amount,expense_date,payment_method)
    SELECT '${owner}','Frais '||n,'fees',100,'2026-10-02','cash' FROM generate_series(1,55) n`)
  const result = await page({offset:50,limit:5000})
  expect(result.count).toBe(57)
  expect(result.total).toBe(120500)
  expect(result.limit).toBe(50)
  expect(result.expenses).toHaveLength(7)
})
it.each(['employee','cashier','admin'])('denies a delegated %s both direct reads and the RPC', async (role) => {
  await db.query("SELECT set_config('test.actor',$1,true),set_config('test.role',$2,true)",[staff,role])
  expect((await db.query('SELECT * FROM public.expenses')).rows).toEqual([])
  expect((await db.query('SELECT * FROM storage.objects')).rows).toEqual([])
  await expect(page()).rejects.toThrow(/proprietaire/)
})
it('denies a suspended owner', async () => {
  await db.query("SELECT set_config('test.status','restricted',true)")
  expect((await db.query('SELECT * FROM public.expenses')).rows).toEqual([])
  await expect(page()).rejects.toThrow(/proprietaire/)
})
it('does not allow an employee to create an expense under their own actor id', async () => {
  await db.query("SELECT set_config('test.actor',$1,true),set_config('test.role','employee',true)",[staff])
  await expect(db.query("INSERT INTO public.expenses(user_id,label,category,amount,expense_date,payment_method) VALUES($1,'Fraude','other',100,'2026-10-01','cash')",[staff])).rejects.toThrow(/row-level security/)
})
it('isolates owners and prevents reassignment to another business',async () => {
  await db.query("SELECT set_config('test.actor',$1,true),set_config('test.owner',$1,true)",[other])
  expect((await page()).total).toBe(900000)
  expect((await db.query('SELECT id FROM public.expenses WHERE id=$1',[first])).rows).toEqual([])
  await expect(db.query('UPDATE public.expenses SET user_id=$1 WHERE user_id=$2',[owner,other])).rejects.toThrow(/permission denied/)
})
it.each([0,-1,1.25,1000000000000])('rejects an invalid amount %s',async (amount) => {
  await expect(db.query("INSERT INTO public.expenses(user_id,label,category,amount,expense_date,payment_method) VALUES($1,'Frais','other',$2,'2026-10-01','cash')",[owner,amount])).rejects.toThrow()
})
it('detects edits and removals in the export version, and prevents stale overwrites',async () => {
  const before = await page()
  await db.query("UPDATE public.expenses SET amount=120000 WHERE id=$1 AND revision=1",[first])
  expect((await page()).version).not.toBe(before.version)
  expect((await db.query('UPDATE public.expenses SET amount=1 WHERE id=$1 AND revision=1 RETURNING id',[first])).rows).toHaveLength(0)
  const revised = await page()
  await db.query('UPDATE public.expenses SET voided_at=now() WHERE id=$1',[first])
  const after = await page()
  expect(after.count).toBe(1)
  expect(after.total).toBe(15000)
  expect(after.version).not.toBe(revised.version)
  await expect(db.query('UPDATE public.expenses SET voided_at=null WHERE id=$1',[first])).rejects.toThrow(/annulee/)
})
it('keeps receipts private and limits Storage reads/uploads to the owner folder', async () => {
  expect((await db.query<{public:boolean}>("SELECT public FROM storage.buckets WHERE id='expense-receipts'")).rows[0].public).toBe(false)
  expect((await db.query('SELECT name FROM storage.objects')).rows).toHaveLength(1)
  await expect(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('expense-receipts',$1)",[`${other}/${first}.jpg`])).rejects.toThrow(/row-level security/)
})
it('rejects a receipt path from another owner in an expense',async () => {
  await expect(db.query('UPDATE public.expenses SET receipt_path=$1 WHERE id=$2',[`${other}/${first}.jpg`,first])).rejects.toThrow(/check constraint/)
})
it('does not grant anonymous table or RPC access',async () => {
  await db.exec('SET LOCAL ROLE anon')
  await expect(page()).rejects.toThrow(/permission denied/)
})
it('does not allow permanent deletion or forged server revisions',async () => {
  await expect(db.query('DELETE FROM public.expenses WHERE id=$1',[first])).rejects.toThrow(/permission denied/)
})
