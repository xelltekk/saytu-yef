import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, beforeEach, afterAll, afterEach, expect, it } from 'vitest'
let db: PGlite
const owner='10000000-0000-0000-0000-000000000001'
const admin='10000000-0000-0000-0000-000000000002'
const cashier='10000000-0000-0000-0000-000000000003'
const other='10000000-0000-0000-0000-000000000004'
const revision='2026-10-01T00:00:00Z'
beforeAll(async () => {
  db=new PGlite()
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    CREATE FUNCTION public.current_account_access_status() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('test.status',true)$$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,email text,full_name text,role text,account_owner_id uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz,subscription_plan text DEFAULT 'free');
    INSERT INTO public.profiles(id,email,full_name,role,account_owner_id,updated_at) VALUES
      ('${owner}','owner@test.fr','Owner','admin','${owner}','${revision}'),
      ('${admin}','admin@test.fr','Admin','admin','${owner}','${revision}'),
      ('${cashier}','cashier@test.fr','Caisse','cashier','${owner}','${revision}'),
      ('${other}','other@test.fr','Other','employee','${other}','${revision}');
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    GRANT SELECT ON public.profiles TO authenticated;
    CREATE POLICY self_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());`)
  await db.exec(readFileSync('supabase/migrations/20261025120024_team_member_edit.sql','utf8'))
},60000)
beforeEach(async () => {
  await db.exec('BEGIN; SET LOCAL ROLE authenticated')
  await db.query("SELECT set_config('test.actor',$1,true),set_config('test.status','active',true)",[owner])
})
afterEach(async () => { await db.exec('ROLLBACK') })
afterAll(async () => { await db?.close() })
const edit = async (id=cashier, name:string|null=' Fatou ', role:string|null='employee', expected:string|null=revision) =>
  (await db.query<{member:Record<string,unknown>}>('SELECT public.update_team_member($1,$2,$3,$4) member',[id,name,role,expected])).rows[0].member
it('atomically updates only name/role with a limited response and new timestamp',async () => {
  const member=await edit()
  expect(member).toMatchObject({id:cashier,full_name:'Fatou',role:'employee',email:'cashier@test.fr',account_owner_id:owner})
  expect(member.updated_at).not.toBe(revision)
  expect(member).not.toHaveProperty('subscription_plan')
})
it('allows an administrator delegated to the same company',async () => {
  await db.query("SELECT set_config('test.actor',$1,true)",[admin])
  expect((await edit()).role).toBe('employee')
})
it.each([owner,admin])('protects owner and self from actor %s',async (actor) => {
  await db.query("SELECT set_config('test.actor',$1,true)",[actor])
  await expect(edit(actor)).rejects.toThrow(/proprietaire/)
})
it('protects the owner from a delegated admin',async () => {
  await db.query("SELECT set_config('test.actor',$1,true)",[admin])
  await expect(edit(owner)).rejects.toThrow(/proprietaire/)
})
it('rejects another company and missing members',async () => {
  await expect(edit(other)).rejects.toThrow(/introuvable/)
})
it.each(['cashier','employee'])('rejects %s actors even when they call the private helper directly',async (role) => {
  await db.exec('RESET ROLE')
  await db.query('UPDATE public.profiles SET role=$1 WHERE id=$2',[role,cashier])
  await db.exec('SET LOCAL ROLE authenticated')
  await db.query("SELECT set_config('test.actor',$1,true)",[cashier])
  await expect(db.query('SELECT app_private.update_team_member($1,$2,$3,$4)',[admin,'Fraude','admin',revision])).rejects.toThrow(/administrateur/)
})
it('rejects suspended accounts',async () => {
  await db.query("SELECT set_config('test.status','restricted',true)")
  await expect(edit()).rejects.toThrow(/actif/)
})
it.each([[null,'admin'],['  ','admin'],['x'.repeat(121),'admin'],['Nom',null],['Nom','root']])('rejects invalid name/role',async (name,role) => {
  await expect(edit(cashier,name,role)).rejects.toThrow(/invalide/)
})
it('refuses stale or absent versions without overwriting a newer edit',async () => {
  await edit()
  await expect(edit(cashier,'Autre','admin')).rejects.toThrow(/change/)
})
it('requires the previous timestamp',async () => {
  await expect(edit(cashier,'Nom','admin',null)).rejects.toThrow(/change/)
})
it('denies anonymous callers on both entry points',async () => {
  await db.exec('SET LOCAL ROLE anon')
  await expect(edit()).rejects.toThrow(/permission denied/)
})
it('does not make the public wrapper privileged or grant profile updates',async () => {
  expect((await db.query<{prosecdef:boolean}>("SELECT prosecdef FROM pg_proc WHERE oid='public.update_team_member(uuid,text,text,timestamptz)'::regprocedure")).rows[0].prosecdef).toBe(false)
  expect((await db.query<{allowed:boolean}>("SELECT has_column_privilege('authenticated','public.profiles','role','UPDATE') allowed")).rows[0].allowed).toBe(false)
})
