import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const database = process.env.SAYTU_TEST_DATABASE ?? ''
const port = Number(process.env.SAYTU_TEST_PORT)
const password = process.env.SAYTU_TEST_PASSWORD
const bin = process.env.SAYTU_TEST_PG_BIN
const cluster = process.env.SAYTU_TEST_CLUSTER
const logs = process.env.SAYTU_TEST_LOGS
if (!/^saytu_restore_test_[a-f0-9]{32}$/.test(database) || !Number.isInteger(port) || port < 1024 || port > 65535 || !password || !bin || !cluster || !logs) {
  throw new Error('Configuration de test isolee requise; aucune connexion de production acceptee.')
}
const normalized = (path) => resolve(path).replaceAll('\\', '/').toLowerCase()
if (!/\/restore-tests\/\d{8}t\d{6}z-[a-f0-9]{32}\/cluster$/.test(normalized(cluster)) || normalized(logs) !== normalized(resolve(cluster, '..', 'concurrency'))) {
  throw new Error('Cluster/dossier prive inattendu.')
}
const psql = resolve(bin, 'psql.exe')
if (!existsSync(psql) || !existsSync(logs)) throw new Error('Outil PostgreSQL ou dossier de test absent.')
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`
const delay = (ms) => new Promise((done) => setTimeout(done, ms))
const active = new Set()
const owners = []
const users = []
const cases = []
let sequence = 0

function start(sql, label, interactive = false) {
  const child = spawn(psql, ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(port), '-U', 'saytu_restore_admin', '-d', database], {
    windowsHide: true,
    env: { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '15', PGCLIENTENCODING: 'UTF8', PGAPPNAME: label, PGOPTIONS: '-c statement_timeout=60000 -c lock_timeout=45000' },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const item = { child, label, stdout: '', stderr: '', closed: false }
  active.add(item)
  child.stdout.setEncoding('utf8').on('data', (chunk) => { item.stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk) => { item.stderr += chunk })
  item.done = new Promise((done) => {
    child.once('error', (error) => { item.stderr += error.message })
    child.once('close', (code) => {
      item.closed = true
      item.code = code
      active.delete(item)
      writeFileSync(resolve(logs, `${++sequence}-${label}.log`), item.stdout + '\n' + item.stderr)
      done(item)
    })
  })
  if (interactive) child.stdin.write(sql + '\n')
  else child.stdin.end(sql + '\n')
  return item
}
async function finish(item) {
  let timer
  try {
    const result = await Promise.race([item.done, new Promise((done) => { timer = setTimeout(() => done(null), 90000) })])
    if (!result) { item.child.kill(); await item.done; throw new Error(`Delai depasse: ${item.label}`) }
    return result
  } finally { clearTimeout(timer) }
}
async function admin(sql) {
  const result = await finish(start(sql, 'admin'))
  if (result.code !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}
async function data(sql) { return JSON.parse(await admin(sql)) }
function actorSql(fixture, actor, sql) {
  return `BEGIN; SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', ${quote(actor)}, true);
    SELECT set_config('request.jwt.claims', ${json({ sub: actor, role: 'authenticated' })}::text, true);
    DO $$ BEGIN IF current_user <> 'authenticated' OR auth.uid() <> ${quote(actor)}::uuid
      OR public.current_account_id() <> ${quote(fixture.owner)}::uuid THEN RAISE EXCEPTION 'Identite de test incorrecte'; END IF; END $$;
    ${sql}; COMMIT;`
}
async function call(fixture, actor, sql) {
  const result = await finish(start(actorSql(fixture, actor, sql), 'setup'))
  if (result.code !== 0) throw new Error(result.stderr)
  return result.stdout.trim().split(/\r?\n/).at(-1)
}
async function waitBlocked(items) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if (items.some((item) => item.closed)) throw new Error(`Worker termine avant la barriere: ${items.map((item) => item.stderr).join('\n')}`)
    const rows = await data(`SELECT coalesce(jsonb_agg(jsonb_build_object('pid', pid, 'waiting', wait_event_type = 'Lock')), '[]')
      FROM pg_stat_activity WHERE application_name IN (${items.map((item) => quote(item.label)).join(',')});`)
    if (rows.length === items.length && rows.every((row) => row.waiting) && new Set(rows.map((row) => row.pid)).size === items.length) return rows.map((row) => row.pid)
    await delay(100)
  }
  throw new Error('Aucune contention multiconnexion verifiee.')
}
async function race(name, fixture, jobs, gateSql, ordered = false) {
  const prefix = `race-${randomUUID().slice(0, 8)}`
  const gate = start(`BEGIN; ${gateSql}; SELECT 'GATE_READY';`, `${prefix}-gate`, true)
  const workers = []
  try {
    const deadline = Date.now() + 30000
    while (!gate.stdout.includes('GATE_READY')) {
      if (gate.closed || Date.now() > deadline) throw new Error(`Barriere non acquise: ${gate.stderr}`)
      await delay(100)
    }
    for (const [index, job] of jobs.entries()) {
      workers.push(start(actorSql(fixture, job.actor, job.sql), `${prefix}-${index}`))
      if (ordered && index === 0) await waitBlocked(workers)
    }
    const pids = await waitBlocked(workers)
    gate.child.stdin.end('COMMIT;\n\\q\n')
    assert.equal((await finish(gate)).code, 0)
    const results = await Promise.all(workers.map(finish))
    const record = { name, backend_pids: pids, overlap_verified: true, exit_codes: results.map((item) => item.code) }
    cases.push(record)
    return { results, record }
  } finally {
    if (!gate.closed && !gate.child.stdin.writableEnded) gate.child.stdin.end('ROLLBACK;\n\\q\n')
    for (const worker of workers) { if (!worker.closed) worker.child.kill() }
    await Promise.all([gate.done, ...workers.map((item) => item.done)])
  }
}
function successes(results, expected, errorPattern) {
  assert.equal(results.filter((item) => item.code === 0).length, expected)
  for (const item of results.filter((entry) => entry.code !== 0)) assert.match(item.stderr, errorPattern ?? /UNEXPECTED_ERROR/)
}
async function fixture(quantity = 10, plan = 'lifetime') {
  const f = { owner: randomUUID(), cashier: randomUUID(), second: randomUUID(), product: randomUUID(), supplier: randomUUID() }
  owners.push(f.owner)
  users.push(f.owner, f.cashier, f.second)
  await admin(`BEGIN;
    INSERT INTO auth.users(id,email,aud,role,raw_user_meta_data) VALUES
      (${quote(f.owner)},${quote(`${f.owner}@example.invalid`)},'authenticated','authenticated','{"full_name":"Concurrency owner"}'),
      (${quote(f.cashier)},${quote(`${f.cashier}@example.invalid`)},'authenticated','authenticated','{"full_name":"Concurrency cashier"}'),
      (${quote(f.second)},${quote(`${f.second}@example.invalid`)},'authenticated','authenticated','{"full_name":"Concurrency cashier"}');
    UPDATE public.profiles SET role='admin',subscription_plan=${quote(plan)},subscription_status='active',account_owner_id=NULL WHERE id=${quote(f.owner)};
    UPDATE public.profiles SET role='cashier',subscription_plan='free',account_owner_id=${quote(f.owner)} WHERE id IN (${quote(f.cashier)},${quote(f.second)});
    INSERT INTO public.suppliers(id,user_id,name) VALUES(${quote(f.supplier)},${quote(f.owner)},'Concurrency supplier');
    INSERT INTO public.products(id,user_id,supplier_id,name,quantity,buying_price,selling_price) VALUES
      (${quote(f.product)},${quote(f.owner)},${quote(f.supplier)},'Concurrency product',${quantity},400,1000);
    INSERT INTO public.cash_sessions(user_id,member_id) VALUES
      (${quote(f.owner)},${quote(f.owner)}),(${quote(f.owner)},${quote(f.cashier)}),(${quote(f.owner)},${quote(f.second)});
    COMMIT;`)
  return f
}
function checkout(f, quantity = 2, payments = [{ amount: 500, payment_method: 'cash' }], request = randomUUID(), due = '2026-01-01') {
  const sale = { customer_name: 'Concurrency client', customer_phone: '770000001', items: [{ product_id: f.product, product_name: 'Concurrency product', quantity, unit_price: 1000, total: quantity * 1000 }], discount: quantity * 100, tax: 0, total: quantity * 900, due_date: due }
  return `SELECT id FROM public.checkout_sale(${quote(request)},${json(sale)},${json(payments)})`
}
const ownerGate = (f) => `SELECT id FROM public.profiles WHERE id=${quote(f.owner)} FOR UPDATE`
const productGate = (f) => `SELECT id FROM public.products WHERE id=${quote(f.product)} FOR UPDATE`
const payment = (sale, amount, request = randomUUID()) => `SELECT id FROM public.record_sale_payment_v2(${quote(request)},${quote(sale)},${amount},'wave',NULL)`
const refund = (sale) => `SELECT id FROM public.reverse_sale_with_stock(${quote(sale)},'refunded','Concurrency test')`
async function state(f) {
  return data(`SELECT jsonb_build_object('stock',(SELECT quantity FROM public.products WHERE id=${quote(f.product)}),
    'sales',(SELECT count(*) FROM public.sales WHERE user_id=${quote(f.owner)}),
    'items',(SELECT coalesce(sum(i.quantity),0) FROM public.sale_items i JOIN public.sales s ON s.id=i.sale_id WHERE s.user_id=${quote(f.owner)}),
    'payments',(SELECT count(*) FROM public.sale_payments WHERE user_id=${quote(f.owner)}),
    'paid',(SELECT coalesce(sum(amount_paid),0) FROM public.sales WHERE user_id=${quote(f.owner)}),
    'due',(SELECT coalesce(sum(amount_due),0) FROM public.sales WHERE user_id=${quote(f.owner)}));`)
}
async function fingerprints() {
  const exclusion = owners.length ? owners.map(quote).join(',') : "'00000000-0000-0000-0000-000000000000'"
  const authExclusion = users.length ? users.map(quote).join(',') : exclusion
  const fields = ['sales', 'sale_items', 'sale_payments', 'products', 'stock_movements', 'profiles', 'auth.users']
  const values = fields.map((table) => {
    const full = table.includes('.') ? table : `public.${table}`
    const where = table === 'sale_items' ? `sale_id IN (SELECT id FROM public.sales WHERE user_id NOT IN (${exclusion}))`
      : table === 'profiles' || table === 'auth.users' ? `id NOT IN (${authExclusion})` : `user_id NOT IN (${exclusion})`
    return `${quote(table)},(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY id),'')) FROM ${full} t WHERE ${where})`
  })
  return data(`SELECT jsonb_build_object(${values.join(',')});`)
}
async function scenario(name, action) {
  const before = cases.length
  const started = Date.now()
  try {
    await action()
    assert.equal(cases.length, before + 1)
    cases.at(-1).status = 'passed'
    console.log(`PASS ${name}`)
  } catch (error) {
    if (cases.length === before) cases.push({ name, overlap_verified: false })
    cases.at(-1).status = 'failed'
    cases.at(-1).error = error.message
    console.log(`FAIL ${name}`)
  } finally {
    cases.at(-1).duration_ms = Date.now() - started
    writeFileSync(resolve(logs, 'report.json'), JSON.stringify(report, null, 2))
  }
}

const report = { database, status: 'started', cases }
try {
  const identity = await data("SELECT jsonb_build_object('database',current_database(),'data',current_setting('data_directory'),'admin',current_user);")
  assert.equal(identity.database, database)
  assert.equal(identity.admin, 'saytu_restore_admin')
  assert.equal(normalized(identity.data), normalized(cluster))
  const baseline = await fingerprints()
  await scenario('stock_insufficient_two_cashiers', async () => {
    const f = await fixture()
    const { results } = await race('stock_insufficient_two_cashiers', f, [{ actor: f.cashier, sql: checkout(f, 6) }, { actor: f.second, sql: checkout(f, 6) }], ownerGate(f))
    successes(results, 1, /Stock insuffisant/)
    assert.deepEqual(await state(f), { stock: 4, sales: 1, items: 6, payments: 1, paid: 500, due: 4900 })
  })
  await scenario('checkout_retry_once', async () => {
    const f = await fixture(5)
    const sql = checkout(f, 2, [{ amount: 500, payment_method: 'cash' }, { amount: 300, payment_method: 'wave' }])
    const { results } = await race('checkout_retry_once', f, [{ actor: f.cashier, sql }, { actor: f.cashier, sql }], ownerGate(f))
    successes(results, 2)
    assert.deepEqual(await state(f), { stock: 3, sales: 1, items: 2, payments: 2, paid: 800, due: 1000 })
  })
  await scenario('checkout_conflicting_retry', async () => {
    const f = await fixture(5); const request = randomUUID()
    const { results } = await race('checkout_conflicting_retry', f, [1, 2].map((qty) => ({ actor: f.cashier, sql: checkout(f, qty, [], request) })), ownerGate(f))
    successes(results, 1, /autre vente/)
    const row = await state(f)
    assert.equal(row.sales, 1); assert.equal(row.stock + row.items, 5); assert.equal(row.paid, 0)
  })
  await scenario('last_free_quota_slot', async () => {
    const f = await fixture(11, 'free')
    await call(f, f.cashier, Array.from({ length: 9 }, () => checkout(f, 1, [{ amount: 900, payment_method: 'cash' }])).join(';'))
    const { results } = await race('last_free_quota_slot', f, [f.cashier, f.second].map((actor) => ({ actor, sql: checkout(f, 1, [{ amount: 900, payment_method: 'cash' }]) })), ownerGate(f))
    successes(results, 1, /10 ventes/)
    assert.deepEqual(await state(f), { stock: 1, sales: 10, items: 10, payments: 10, paid: 9000, due: 0 })
  })
  await scenario('payment_retry_once', async () => {
    const f = await fixture(); const sale = await call(f, f.cashier, checkout(f)); const sql = payment(sale, 500)
    const { results } = await race('payment_retry_once', f, [{ actor: f.cashier, sql }, { actor: f.cashier, sql }], ownerGate(f))
    successes(results, 2)
    assert.deepEqual(await state(f), { stock: 8, sales: 1, items: 2, payments: 2, paid: 1000, due: 800 })
  })
  await scenario('payment_overpayment_race', async () => {
    const f = await fixture(); const sale = await call(f, f.cashier, checkout(f))
    const { results } = await race('payment_overpayment_race', f, [{ actor: f.cashier, sql: payment(sale, 600) }, { actor: f.second, sql: payment(sale, 800) }], ownerGate(f))
    successes(results, 1, /depasse le reste du/)
    const row = await state(f)
    assert.equal(row.payments, 2); assert.equal(row.paid + row.due, 1800); assert(row.due >= 0); assert([1100, 1300].includes(row.paid))
  })
  await scenario('payment_no_lost_update', async () => {
    const f = await fixture(); const sale = await call(f, f.cashier, checkout(f))
    const { results } = await race('payment_no_lost_update', f, [{ actor: f.cashier, sql: payment(sale, 500) }, { actor: f.second, sql: payment(sale, 600) }], ownerGate(f))
    successes(results, 2)
    assert.deepEqual(await state(f), { stock: 8, sales: 1, items: 2, payments: 3, paid: 1600, due: 200 })
  })
  for (const mixed of [false, true]) await scenario(mixed ? 'global_and_individual_payment' : 'global_payment_retry_once', async () => {
    const f = await fixture()
    await call(f, f.cashier, checkout(f, 2, []))
    const secondSale = await call(f, f.cashier, checkout(f, 2, [], randomUUID(), '2026-01-02'))
    const customer = await admin(`SELECT customer_id FROM public.sales WHERE id=${quote(secondSale)};`)
    const sql = `SELECT public.pay_customer_debts(${quote(randomUUID())},${quote(customer)},2500,'cash')`
    const jobs = [{ actor: f.cashier, sql }, mixed ? { actor: f.second, sql: payment(secondSale, 500) } : { actor: f.cashier, sql }]
    const { results } = await race(mixed ? 'global_and_individual_payment' : 'global_payment_retry_once', f, jobs, ownerGate(f))
    successes(results, 2)
    const row = await state(f)
    assert.equal(row.sales, 2); assert.equal(row.paid, mixed ? 3000 : 2500); assert.equal(row.due, mixed ? 600 : 1100)
    assert.equal(Number(await admin(`SELECT count(*) FROM public.customer_payment_requests WHERE user_id=${quote(f.owner)};`)), 1)
  })
  await scenario('refund_once', async () => {
    const f = await fixture(); const sale = await call(f, f.cashier, checkout(f)); const sql = refund(sale)
    const { results } = await race('refund_once', f, [{ actor: f.owner, sql }, { actor: f.owner, sql }], `SELECT id FROM public.sales WHERE id=${quote(sale)} FOR UPDATE`)
    successes(results, 1, /deja annulee ou remboursee/)
    assert.equal((await state(f)).stock, 10)
    assert.equal(Number(await admin(`SELECT count(*) FROM public.stock_movements WHERE user_id=${quote(f.owner)} AND movement_type='in';`)), 1)
  })
  async function order(f) { return call(f, f.owner, `SELECT public.create_purchase_order(${quote(f.supplier)},${json([{ product_id: f.product, quantity: 4, unit_cost: 350 }])},NULL)`) }
  await scenario('receive_order_once', async () => {
    const f = await fixture(); const id = await order(f); const sql = `SELECT public.update_purchase_order(${quote(id)},'received')`
    const { results } = await race('receive_order_once', f, [{ actor: f.owner, sql }, { actor: f.owner, sql }], `SELECT id FROM public.purchase_orders WHERE id=${quote(id)} FOR UPDATE`)
    successes(results, 2)
    assert.equal((await state(f)).stock, 14)
    assert.equal(Number(await admin(`SELECT count(*) FROM public.stock_movements WHERE user_id=${quote(f.owner)} AND movement_type='in';`)), 1)
  })
  await scenario('refund_during_payment', async () => {
    const f = await fixture(); const sale = await call(f, f.cashier, checkout(f))
    const { results } = await race('refund_during_payment', f, [{ actor: f.owner, sql: refund(sale) }, { actor: f.cashier, sql: payment(sale, 500) }], productGate(f), true)
    assert.equal(results[0].code, 0); assert.notEqual(results[1].code, 0); assert.match(results[1].stderr, /Versement impossible/)
    assert.deepEqual(await state(f), { stock: 10, sales: 1, items: 2, payments: 1, paid: 500, due: 0 })
  })
  await scenario('receive_order_during_checkout', async () => {
    const f = await fixture(); const id = await order(f)
    const { results } = await race('receive_order_during_checkout', f, [{ actor: f.owner, sql: `SELECT public.update_purchase_order(${quote(id)},'received')` }, { actor: f.cashier, sql: checkout(f) }], productGate(f), true)
    successes(results, 2)
    assert.equal((await state(f)).stock, 12)
    assert.equal(Number(await admin(`SELECT unit_cost FROM public.sale_items WHERE product_id=${quote(f.product)};`)), 350)
  })
  assert.deepEqual(await fingerprints(), baseline)
  report.historical_rows_unchanged = true
  report.status = cases.every((item) => item.status === 'passed') ? 'passed' : 'failed'
} catch (error) { report.status = 'failed'; report.error = error.message }
finally {
  for (const item of active) item.child.kill()
  await Promise.all([...active].map((item) => item.done))
  writeFileSync(resolve(logs, 'report.json'), JSON.stringify(report, null, 2))
}
console.log(`${cases.filter((item) => item.status === 'passed').length}/${cases.length} concurrent scenarios passed. Report: ${resolve(logs, 'report.json')}`)
process.exitCode = report.status === 'passed' ? 0 : 1
