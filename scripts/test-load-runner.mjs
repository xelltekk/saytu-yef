import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { FIXTURE_KIND } from '../ops/load/spec.mjs'

const binary = process.env.LOCAL_K6_BINARY
assert(binary, 'Set LOCAL_K6_BINARY to the portable, verified k6 executable')
const output = resolve('.load-lab/runner-proof')
await mkdir(output, { recursive: true })
const dir = await mkdtemp(resolve(output, 'run-'))
const actor = '10000000-0000-0000-0000-000000000001'
const product = '20000000-0000-0000-0000-000000000001'
let mode = 'valid'
const requests = []
let fixture
const server = createServer(async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  assert.equal(req.method, 'POST')
  const path = req.url.split('/').pop()
  requests.push(path)
  res.setHeader('Content-Type', 'application/json')
  if (path === 'load_test_identity') {
    if (mode === 'missing-marker') { res.statusCode = 404; res.end('{}'); return }
    if (mode === 'redirect') { res.statusCode = 301; res.setHeader('Location', 'https://saytu-yef.xelltekk.com'); res.end('{}'); return }
    res.end(JSON.stringify({ ...fixture, accounts: undefined, apiKey: undefined, actorId: actor, ownerId: actor, role: 'admin' }))
  } else if (path === 'list_catalogue_page') {
    res.end(JSON.stringify({ ownerId: mode === 'foreign' ? product : actor, totalVariants: 10,
      groupIds: [product], products: [{ user_id: actor, id: product }] }))
  } else if (path === 'lookup_catalogue_code') {
    res.end(JSON.stringify({ ownerId: actor, product: { user_id: mode === 'foreign-scanner' ? product : actor, id: product } }))
  } else if (path === 'get_reports_summary') {
    res.end(JSON.stringify({ ownerId: actor, appliedSellerId: null, salesCount: 20, monthlyData: Array(12).fill({ revenue: 100, profit: 50 }), topProducts: [] }))
  } else { res.statusCode = 404; res.end('{}') }
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const baseUrl = `http://127.0.0.1:${server.address().port}`
const token = `e30.${Buffer.from(JSON.stringify({ sub: actor, role: 'authenticated', iss: `${baseUrl}/auth/v1`, exp: 9999999999 })).toString('base64url')}.mock-signature`
fixture = { kind: FIXTURE_KIND, baseUrl, runId: '30000000-0000-0000-0000-000000000001', apiKey: 'sb_publishable_mock',
  shops: 1, variantsPerShop: 10, salesPerShop: 20, accounts: [{ actorId: actor, ownerId: actor, role: 'admin',
    productId: product, barcode: 'LOAD-1-1', expectedSales: 20, accessToken: token }] }
const fixtureFile = resolve(dir, 'fixture.json')
await writeFile(fixtureFile, JSON.stringify(fixture), { mode: 0o600 })
const configFile = resolve(dir, 'k6-config.json')
await writeFile(configFile, '{}')
try {
  for (mode of ['valid', 'foreign', 'foreign-scanner', 'missing-marker', 'redirect']) {
    const resultFile = resolve(dir, `${mode}.json`)
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^K6_|^(HTTP|HTTPS|ALL)_PROXY$/i.test(key)))
    Object.assign(env, { LOAD_PROFILE: 'smoke', LOAD_FIXTURE: fixtureFile, LOAD_RESULT: resultFile, K6_NO_USAGE_REPORT: 'true', NO_PROXY: '127.0.0.1' })
    const child = spawn(binary, ['run', '--config', configFile, '--no-usage-report', '--include-system-env-vars=false',
      '--env', 'LOAD_PROFILE=smoke', '--env', `LOAD_FIXTURE=${fixtureFile}`, '--env', `LOAD_RESULT=${resultFile}`,
      resolve('ops/load/reads.k6.js')], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', (part) => { stdout += part })
    child.stderr.on('data', (part) => { stderr += part })
    const timeout = setTimeout(() => child.kill(), 45000)
    const [code] = await once(child, 'exit')
    clearTimeout(timeout)
    assert(!stdout.includes(token) && !stderr.includes(token), 'Tokens must not appear in logs')
    if (mode === 'valid') {
      assert.equal(code, 0, stderr)
      const summary = await readFile(resultFile, 'utf8')
      assert(!summary.includes(token) && !summary.includes('sb_publishable_mock'))
      const metrics = JSON.parse(summary).metrics
      assert.equal(metrics.contract_errors.values.count, 0)
      assert.equal(metrics.isolation_errors.values.count, 0)
      assert(requests.includes('get_reports_summary'))
    } else {
      assert.notEqual(code, 0, 'Unsafe or unmarked target must fail the run')
      if (mode === 'foreign-scanner') assert.equal(requests.includes('get_reports_summary'), false)
      if (mode === 'missing-marker' || mode === 'redirect') assert.equal(requests.filter((path) => path !== 'load_test_identity').length, 0)
    }
    console.log(`PASS k6 mock contract: ${mode}. This is not an application load measurement.`)
    requests.length = 0
  }
} finally { await new Promise((done) => server.close(done)) }
