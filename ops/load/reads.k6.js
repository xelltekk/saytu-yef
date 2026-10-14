/* global __ENV, open */
import http from 'k6/http'
import { sleep } from 'k6'
import execution from 'k6/execution'
import encoding from 'k6/encoding'
import { Counter, Trend } from 'k6/metrics'
import { SharedArray } from 'k6/data'
import { catalogueMatches, identityMatches, measuredPhases, phaseLabel, reportMatches, validateFixture } from './spec.mjs'

const profile = __ENV.LOAD_PROFILE || 'smoke'
const fixtures = new SharedArray('local-fixture', () => {
  const decode = (token) => {
    try { return JSON.parse(encoding.b64decode(token.split('.')[1], 'rawurl', 's')) } catch { return null }
  }
  return [validateFixture(JSON.parse(open(__ENV.LOAD_FIXTURE)), profile, decode)]
})
const fixture = fixtures[0]
const scenario = { ...fixture.plan }
delete scenario.peak
delete scenario.seconds
const contractErrors = new Counter('contract_errors')
const isolationErrors = new Counter('isolation_errors')
const latency = new Trend('rpc_latency', true)
const observations = new Counter('rpc_observations')
const phaseIterations = new Counter('phase_iterations')
const thresholds = {
  contract_errors: [{ threshold: 'count<1', abortOnFail: true }],
  isolation_errors: [{ threshold: 'count<1', abortOnFail: true }],
  http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '10s' }],
}
for (const phase of measuredPhases(profile)) {
  const minimum = profile === 'smoke' ? 5 : ['owners2', 'cashiers6'].includes(profile) ? fixture.plan.peak * 40 : 50
  thresholds[`phase_iterations{phase:${phase}}`] = [`count>=${minimum}`]
  for (const [operation, limit] of [['catalogue', 2500], ['scanner', 1500], ['report', 5000]]) {
    thresholds[`rpc_latency{operation:${operation},phase:${phase}}`] = [`p(95)<${limit}`]
    thresholds[`rpc_observations{operation:${operation},phase:${phase}}`] = ['count>=1']
  }
}
export const options = {
  scenarios: { reads: scenario },
  maxRedirects: 0, discardResponseBodies: false,
  systemTags: ['status', 'method', 'name', 'scenario', 'expected_response'],
  thresholds,
}

function rpc(name, args, account, operation) {
  const response = http.post(`${fixture.baseUrl}/rest/v1/rpc/${name}`, JSON.stringify(args), {
    headers: { apikey: fixture.apiKey, Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
    tags: { name: operation }, timeout: '15s', redirects: 0,
  })
  if (operation !== 'identity') {
    const tags = { operation, phase: phaseLabel(profile, (Date.now() - execution.scenario.startTime) / 1000) }
    latency.add(response.timings.duration, tags)
    observations.add(1, tags)
  }
  if (response.status !== 200) { contractErrors.add(1); execution.test.abort(`RPC ${operation} indisponible; arret du banc local`) }
  try { return response.json() } catch { contractErrors.add(1); execution.test.abort('Reponse JSON invalide') }
}

function requireContract(matches, message) {
  contractErrors.add(matches ? 0 : 1)
  if (!matches) execution.test.abort(message)
}

export function setup() {
  for (const account of fixture.accounts) {
    const marker = rpc('load_test_identity', {}, account, 'identity')
    requireContract(identityMatches(marker, fixture, account), 'La cible ne correspond pas au jeu local marque; aucune charge lancee')
  }
}

export default function readIteration() {
  const account = fixture.accounts[(execution.vu.idInTest - 1) % fixture.accounts.length]
  const iteration = execution.vu.iterationInScenario
  const catalogue = rpc('list_catalogue_page', { p_options: { scope: iteration % 2 ? 'pos' : 'inventory', limit: 24, offset: 0, images: false } }, account, 'catalogue')
  const isolated = catalogue?.ownerId === account.ownerId && catalogue.products?.every((product) => product.user_id === account.ownerId)
  isolationErrors.add(isolated ? 0 : 1)
  requireContract(catalogueMatches(catalogue, fixture, account), 'Resultat catalogue incoherent')
  const scan = rpc('lookup_catalogue_code', { p_code: account.barcode, p_scope: 'pos' }, account, 'scanner')
  const scanIsolated = scan?.ownerId === account.ownerId && scan.product?.user_id === account.ownerId
  isolationErrors.add(scanIsolated ? 0 : 1)
  requireContract(scanIsolated && scan?.product?.id === account.productId, 'Le scanner ne retrouve pas la variante fictive attendue')
  if (iteration % 20 === 0) {
    const report = rpc('get_reports_summary', { p_options: { start: '2025-01-01T00:00:00Z', endExclusive: '2026-01-01T00:00:00Z', granularity: 'month', timeZone: 'UTC' } }, account, 'report')
    isolationErrors.add(report?.ownerId === account.ownerId ? 0 : 1)
    requireContract(reportMatches(report, account), 'Resultat annuel ou perimetre vendeur incoherent')
  }
  phaseIterations.add(1, { phase: phaseLabel(profile, (Date.now() - execution.scenario.startTime) / 1000) })
  sleep(2)
}

export function handleSummary(data) {
  // Never persist accounts, tokens, bodies or setup data in the result.
  const metrics = {}
  for (const [name, metric] of Object.entries(data.metrics)) metrics[name] = { values: metric.values, thresholds: metric.thresholds }
  return { [__ENV.LOAD_RESULT]: JSON.stringify({ kind: 'local-api-reads', profile, runId: fixture.runId,
    shops: fixture.shops, variantsPerShop: fixture.variantsPerShop, salesPerShop: fixture.salesPerShop,
    conclusions: 'Local read-RPC measurements only; not a production capacity certificate or checkout benchmark.', metrics }, null, 2) }
}
