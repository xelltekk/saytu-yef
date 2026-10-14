import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, writeFile, access, rename } from 'node:fs/promises'
import { freemem } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { FIXTURE_KIND, localTarget, validateFixture, identityMatches, catalogueMatches, reportMatches } from '../ops/load/spec.mjs'
import { expandedFixture, expansionSql } from '../ops/load/expand.mjs'

const exec = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const lab = resolve(process.env.LOCALAPPDATA, 'SaytuYefLoadLab')
const project = 'saytu-yef-load-lab'
const policyMigration = resolve(root, 'supabase/migrations/20261014133001_sale_items_read_policy_performance.sql')
const container = `supabase_db_${project}`
const docker = process.env.LOCAL_DOCKER_BINARY || 'docker'
const env = { ...process.env, DOCKER_HOST: 'npipe:////./pipe/dockerDesktopLinuxEngine' }
delete env.DOCKER_CONTEXT
delete env.DOCKER_TLS_VERIFY
delete env.DOCKER_CERT_PATH
const decode = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
const localFetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input)
  if (url.origin !== 'http://127.0.0.1:55321') throw new Error('Requete hors laboratoire refusee')
  return fetch(input, { ...init, redirect: 'error', signal: init?.signal ?? AbortSignal.timeout(15000) })
}
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: localFetch } }
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const clientFor = (fixture, account) => createClient(fixture.baseUrl, fixture.apiKey, {
  ...options, global: { ...options.global, headers: { Authorization: `Bearer ${account.accessToken}` } },
})

async function sessions(fixture, logins) {
  validateFixture(fixture, 'smoke', decode, 0)
  if (fixture.baseUrl !== 'http://127.0.0.1:55321' || logins.length !== fixture.accounts.length) throw new Error('Sessions locales incoherentes')
  for (let index = 0; index < logins.length; index++) {
    const client = createClient(fixture.baseUrl, fixture.apiKey, options)
    const login = await client.auth.signInWithPassword(logins[index])
    if (login.error || login.data.user.id !== fixture.accounts[index].actorId) throw new Error('Connexion fictive locale impossible')
    fixture.accounts[index].accessToken = login.data.session.access_token
  }
  validateFixture(fixture, 'smoke', decode)
}

async function sql(statement) {
  return new Promise((accept, reject) => {
    const child = spawn(docker, ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
      { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', (data) => { stdout += data })
    child.stderr.on('data', (data) => { stderr += data })
    child.on('error', reject)
    child.stdin.on('error', () => {})
    child.on('close', async (code) => {
      if (code !== 0) {
        await writeFile(resolve(lab, 'sql-error.log'), stderr, { mode: 0o600 })
        reject(new Error('SQL local refuse; diagnostic conserve dans le dossier prive.'))
      } else accept(stdout.trim())
    })
    child.stdin.end(statement)
  })
}

async function verify(fixture) {
  validateFixture(fixture, 'smoke', decode)
  const anonymous = createClient(fixture.baseUrl, fixture.apiKey, options)
  const anonymousMarker = await anonymous.rpc('load_test_identity')
  const anonymousCatalogue = await anonymous.rpc('list_catalogue_page', { p_options: { limit: 1 } })
  if (!anonymousMarker.error || !anonymousCatalogue.error) throw new Error('Acces anonyme au laboratoire non conforme')
  const period = { start: '2025-01-01T00:00:00Z', endExclusive: '2026-01-01T00:00:00Z', granularity: 'month', timeZone: 'UTC' }
  for (const account of fixture.accounts) {
    const client = clientFor(fixture, account)
    const marker = await client.rpc('load_test_identity')
    if (marker.error || !identityMatches(marker.data, fixture, account)) throw new Error('Marqueur local non conforme')
    const catalogue = await client.rpc('list_catalogue_page', { p_options: { limit: 24, images: false } })
    if (catalogue.error || !catalogueMatches(catalogue.data, fixture, account)) throw new Error('Catalogue local non conforme')
    const report = await client.rpc('get_reports_summary', { p_options: period })
    if (report.error || !reportMatches(report.data, account)) throw new Error('Rapport local non conforme')
    if (report.data.totalInvoiced !== account.expectedSales * 1000 || report.data.cashCollected !== account.expectedSales * 1000
      || report.data.totalDue !== 0 || report.data.totalSold !== account.expectedSales
      || report.data.monthlyData.reduce((sum, month) => sum + month.profit, 0) !== account.expectedSales * 600) {
      throw new Error('Montants financiers des fixtures non conformes')
    }
    const ownScan = await client.rpc('lookup_catalogue_code', { p_code: account.barcode, p_scope: 'pos' })
    const ownItems = await client.from('sale_items').select('id').eq('product_id', account.productId).limit(1)
    if (ownScan.error || ownScan.data?.product?.id !== account.productId || ownItems.error || ownItems.data.length !== 1) {
      throw new Error('Variante ou articles propres inaccessibles')
    }
    const foreign = fixture.accounts.find((other) => other.ownerId !== account.ownerId)
    if (!foreign) throw new Error('Deux boutiques requises pour verifier l isolation')
    const row = await client.from('products').select('id').eq('id', foreign.productId)
    const foreignItems = await client.from('sale_items').select('id').eq('product_id', foreign.productId).limit(1)
    const scan = await client.rpc('lookup_catalogue_code', { p_code: foreign.barcode, p_scope: 'pos' })
    const foreignReport = await client.rpc('get_reports_summary', { p_options: { ...period, sellerId: foreign.actorId } })
    if (row.error || row.data.length !== 0 || foreignItems.error || foreignItems.data.length !== 0 || scan.error || scan.data?.product
      || (account.role === 'admin' && !foreignReport.error)
      || (account.role === 'cashier' && (foreignReport.error || !reportMatches(foreignReport.data, account)))) {
      throw new Error('Isolation entre boutiques ou vendeurs non conforme')
    }
  }
  console.log(`Verification reelle: ${fixture.accounts.length} comptes, catalogue, rapports, RLS et codes etrangers refuses.`)
}

try {
  if (!['initialize', 'expand', 'diagnose', 'optimize', 'refresh', 'verify'].includes(process.argv[2]) || process.argv.length !== 3) throw new Error('Choisir initialize, expand, diagnose, optimize, refresh ou verify')
  const config = await readFile(resolve(lab, 'supabase/config.toml'), 'utf8')
  if (!/^project_id = "saytu-yef-load-lab"$/m.test(config)) throw new Error('Projet prive incorrect')
  try { await access(resolve(lab, 'supabase/.temp/project-ref')); throw new Error('Projet lie au cloud refuse') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const inspection = JSON.parse((await exec(docker, ['inspect', container], { env, windowsHide: true })).stdout)[0]
  if (inspection.Name !== `/${container}` || !inspection.State.Running
    || inspection.Config.Labels?.['com.supabase.cli.project'] !== project) throw new Error('Conteneur local non conforme')
  if (['diagnose', 'optimize'].includes(process.argv[2])) {
    const fixture = JSON.parse(await readFile(resolve(lab, 'credentials.json'), 'utf8'))
    validateFixture(fixture, 'smoke', decode)
    const owner = fixture.accounts.find((account) => account.role === 'admin')
    const period = { start: '2025-01-01T00:00:00Z', endExclusive: '2026-01-01T00:00:00Z', granularity: 'month', timeZone: 'UTC' }
    const policy = await readFile(policyMigration, 'utf8')
    if (process.argv[2] === 'optimize') {
      await verify(fixture)
      await sql(`BEGIN; DO $$ BEGIN
        IF NOT EXISTS(SELECT 1 FROM load_lab.identity WHERE actor_id=${quote(owner.actorId)}
          AND body->>'runId'=${quote(fixture.runId)}) THEN RAISE EXCEPTION 'Laboratoire incorrect'; END IF;
        END $$; ${policy} COMMIT;`)
      await verify(fixture)
      console.log('Optimisation de lecture des articles appliquee et reverifiee uniquement dans le laboratoire.')
    } else for (const [index, variant] of [
      { jit: 'on', rewrite: false }, { jit: 'off', rewrite: false },
      { jit: 'on', rewrite: true }, { jit: 'off', rewrite: true },
    ].entries()) {
      const { jit, rewrite } = variant
      const plan = JSON.parse(await sql(`BEGIN;
        SET LOCAL statement_timeout='30s'; SET LOCAL jit=${jit};
        DO $$ BEGIN
          IF NOT EXISTS(SELECT 1 FROM load_lab.identity WHERE actor_id=${quote(owner.actorId)}
            AND body->>'runId'=${quote(fixture.runId)}) THEN RAISE EXCEPTION 'Laboratoire incorrect'; END IF;
        END $$;
        ${rewrite ? policy : ''}
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims=${quote(JSON.stringify({ sub: owner.actorId, role: 'authenticated' }))};
        EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT public.get_reports_summary(${quote(JSON.stringify(period))}::jsonb);
        ROLLBACK;`))
      const filename = `report-plan-${new Date().toISOString().replace(/[:.]/g, '-')}-${index}-jit-${jit}-policy-${rewrite}.json`
      await writeFile(resolve(lab, 'results', filename), JSON.stringify(plan, null, 2), { mode: 0o600 })
      console.log(JSON.stringify({ jit, rewrite, executionMs: plan[0]['Execution Time'], sharedHits: plan[0].Plan['Shared Hit Blocks'],
        tempWritten: plan[0].Plan['Temp Written Blocks'], note: 'Outer RPC plan with actual authenticated RLS; nested plans not exposed.' }))
    }
  } else if (process.argv[2] === 'expand') {
    if (freemem() < 1024 ** 3) throw new Error('Au moins 1 Gio de RAM libre requis pour l extension')
    const before = JSON.parse(await readFile(resolve(lab, 'credentials.json'), 'utf8'))
    await sessions(before, JSON.parse(await readFile(resolve(lab, 'logins.json'), 'utf8')))
    const after = expandedFixture(before, decode)
    await sql(expansionSql(before, after))
    await verify(after)
    await writeFile(resolve(lab, 'credentials.next.json'), JSON.stringify(after, null, 2), { mode: 0o600 })
    await rename(resolve(lab, 'credentials.next.json'), resolve(lab, 'credentials.json'))
    console.log('Extension validee: 2 boutiques, 2400 variantes, 36500 ventes et leurs articles/versements. Aucune suppression.')
  } else if (process.argv[2] === 'refresh') {
    const fixture = JSON.parse(await readFile(resolve(lab, 'credentials.json'), 'utf8'))
    await sessions(fixture, JSON.parse(await readFile(resolve(lab, 'logins.json'), 'utf8')))
    await verify(fixture)
    await writeFile(resolve(lab, 'credentials.json'), JSON.stringify(fixture, null, 2), { mode: 0o600 })
    console.log('Sessions fictives locales renouvelees.')
  } else if (process.argv[2] === 'verify') {
    await verify(JSON.parse(await readFile(resolve(lab, 'credentials.json'), 'utf8')))
  } else {
    const status = JSON.parse((await readFile(resolve(lab, 'status.json'), 'utf8')).replace(/^\uFEFF/, ''))
    const baseUrl = localTarget(status.API_URL)
    if (baseUrl !== 'http://127.0.0.1:55321' || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Etat CLI local incorrect')
    const empty = await sql("SELECT to_regclass('public.profiles') IS NULL AND NOT EXISTS(SELECT 1 FROM auth.users);")
    if (empty !== 't') throw new Error('La base n est pas vide; aucune reinitialisation automatique')
    const baseline = (await exec('git', ['show', '86f562a186f04f796627c6b00d7f031e37a78738:supabase/schema.sql'], { cwd: root })).stdout
    const folder = resolve(root, 'supabase/migrations')
    const files = (await readdir(folder)).filter((file) => /^\d+_[\w]+\.sql$/.test(file)).sort()
    const migrations = await Promise.all(files.map(async (file) => {
      // An old manual upgrade changed OUT columns without dropping the previous signature.
      const compatibility = file === '202607181930_support_console_ops.sql'
        ? 'DROP FUNCTION public.list_support_platform_accounts(integer,text,text,text);\n' : ''
      return compatibility + (await readFile(resolve(folder, file), 'utf8'))
        .replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, '')
    }))
    await sql(`BEGIN;\n${baseline}\n${migrations.join('\n')}\nCOMMIT;`)
    console.log(`Schema initial historique et ${files.length} migrations installes uniquement en local.`)

    const service = createClient(baseUrl, status.SERVICE_ROLE_KEY, options)
    const fixture = { kind: FIXTURE_KIND, runId: randomUUID(), baseUrl, apiKey: status.ANON_KEY,
      shops: 2, variantsPerShop: 12, salesPerShop: 50, accounts: [] }
    const logins = []
    for (let shop = 0; shop < fixture.shops; shop++) {
      let ownerId
      const productId = randomUUID()
      const barcode = `LOAD-${fixture.runId.slice(0, 8)}-${shop}-1`
      for (let member = 0; member < 4; member++) {
        const email = `load-${fixture.runId}-${shop}-${member}@example.invalid`
        const password = randomUUID() + randomUUID()
        const created = await service.auth.admin.createUser({ email, password, email_confirm: true })
        if (created.error) throw new Error('Creation du compte fictif local impossible')
        const actorId = created.data.user.id
        if (member === 0) ownerId = actorId
        await sql(`UPDATE public.profiles SET role=${quote(member ? 'cashier' : 'admin')}, account_owner_id=${quote(ownerId)},
          business_name='Boutique fictive ${shop + 1}',subscription_plan='lifetime',subscription_status='active' WHERE id=${quote(actorId)};`)
        fixture.accounts.push({ actorId, ownerId, productId, barcode, role: member ? 'cashier' : 'admin',
          expectedSales: member ? Math.floor(50 / 3) + (member <= 50 % 3 ? 1 : 0) : 50,
          accessToken: 'pending' })
        logins.push({ email, password })
      }
      const members = fixture.accounts.filter((account) => account.ownerId === ownerId && account.role === 'cashier')
      await sql(`BEGIN;
        CREATE TEMP TABLE fixture_products AS SELECT CASE WHEN n=1 THEN ${quote(productId)}::uuid ELSE gen_random_uuid() END id,
          n, md5(${quote(ownerId)} || '-' || ((n-1)/2)::text)::uuid group_id FROM generate_series(1,12) n;
        INSERT INTO public.products(id,user_id,name,product_group_id,barcode,buying_price,selling_price,quantity,currency,status)
          SELECT id,${quote(ownerId)},'Produit fictif ' || ((n-1)/2+1),group_id,
            ${quote(barcode.slice(0, -1))} || n,400,1000,100,'XOF','active' FROM fixture_products;
        CREATE TEMP TABLE fixture_sales AS SELECT gen_random_uuid() id,n FROM generate_series(1,50) n;
        INSERT INTO public.sales(id,user_id,seller_id,subtotal,discount,tax,total,amount_paid,amount_due,payment_method,payment_status,created_at)
          SELECT id,${quote(ownerId)},(ARRAY[${members.map((member) => quote(member.actorId) + '::uuid').join(',')}])[(n-1)%3+1],
            1000,0,0,1000,1000,0,'cash','completed','2025-01-01'::timestamptz+(n-1)*interval '7 days' FROM fixture_sales;
        -- Historical read fixtures, not checkouts: keep stock stable while building the data set.
        ALTER TABLE public.sale_items DISABLE TRIGGER USER;
        INSERT INTO public.sale_items(sale_id,product_id,product_name,quantity,unit_price,total,unit_cost,created_at)
          SELECT s.id,p.id,'Produit fictif',1,1000,1000,400,'2025-01-01'::timestamptz+(s.n-1)*interval '7 days'
          FROM fixture_sales s JOIN fixture_products p ON p.n=(s.n-1)%12+1;
        ALTER TABLE public.sale_items ENABLE TRIGGER USER;
        INSERT INTO public.sale_payments(sale_id,user_id,recorded_by_id,amount,payment_method,created_at)
          SELECT id,user_id,seller_id,1000,'cash',created_at FROM public.sales WHERE user_id=${quote(ownerId)};
        COMMIT;`)
    }
    await sql(`BEGIN;
      CREATE SCHEMA load_lab;
      REVOKE ALL ON SCHEMA load_lab FROM PUBLIC,anon,authenticated;
      CREATE TABLE load_lab.identity(actor_id uuid PRIMARY KEY,body jsonb NOT NULL);
      ALTER TABLE load_lab.identity ENABLE ROW LEVEL SECURITY;
      INSERT INTO load_lab.identity VALUES ${fixture.accounts.map((account) => `(${quote(account.actorId)},${quote(JSON.stringify({
        kind: fixture.kind, runId: fixture.runId, shops: fixture.shops, variantsPerShop: fixture.variantsPerShop,
        salesPerShop: fixture.salesPerShop, actorId: account.actorId, ownerId: account.ownerId, role: account.role,
      }))}::jsonb)`).join(',')};
      CREATE FUNCTION public.load_test_identity() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
        SELECT body FROM load_lab.identity WHERE actor_id=(SELECT auth.uid());
      $$;
      REVOKE ALL ON FUNCTION public.load_test_identity() FROM PUBLIC,anon;
      GRANT EXECUTE ON FUNCTION public.load_test_identity() TO authenticated;
      NOTIFY pgrst,'reload schema'; COMMIT;
      ANALYZE public.profiles; ANALYZE public.products; ANALYZE public.sales; ANALYZE public.sale_items; ANALYZE public.sale_payments;`)
    await writeFile(resolve(lab, 'logins.json'), JSON.stringify(logins), { mode: 0o600, flag: 'wx' })
    // First sign-in precedes JWT validation; refreshes validate the old local identity first.
    for (let index = 0; index < logins.length; index++) {
      const client = createClient(baseUrl, fixture.apiKey, options)
      const login = await client.auth.signInWithPassword(logins[index])
      if (login.error || login.data.user.id !== fixture.accounts[index].actorId) throw new Error('Connexion fictive locale impossible')
      fixture.accounts[index].accessToken = login.data.session.access_token
    }
    validateFixture(fixture, 'smoke', decode)
    await writeFile(resolve(lab, 'credentials.json'), JSON.stringify(fixture, null, 2), { mode: 0o600, flag: 'wx' })
    await verify(fixture)
    console.log('Petit jeu pret: 2 boutiques, 8 comptes, 24 variantes, 100 ventes historiques fictives. Production inchangee.')
  }
} catch (error) {
  // SDK/CLI errors may include keys or requests: expose only controlled messages.
  const message = error instanceof Error && !error.code && !error.message.includes('http') ? error.message : 'Preparation locale interrompue'
  console.error(message)
  process.exitCode = 1
}
