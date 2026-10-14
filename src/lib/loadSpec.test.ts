import { expect, it } from 'vitest'
import { catalogueMatches, FIXTURE_KIND, identityMatches, loadPlan, localTarget, measuredPhases, phaseLabel, reportMatches, validateFixture } from '../../ops/load/spec.mjs'
import { expandedFixture, expansionSql } from '../../ops/load/expand.mjs'

const owner = '10000000-0000-0000-0000-000000000001'
const cashier = '10000000-0000-0000-0000-000000000002'
const product = '20000000-0000-0000-0000-000000000001'
const account = { actorId: owner, ownerId: owner, productId: product, role: 'admin', barcode: 'LOAD-1-1', expectedSales: 20, accessToken: 'owner-token' }
const fixture = { kind: FIXTURE_KIND, runId: '30000000-0000-0000-0000-000000000001', baseUrl: 'http://127.0.0.1:55321',
  apiKey: 'sb_publishable_test', shops: 1, variantsPerShop: 10, salesPerShop: 20, accounts: [account] }
const decode = () => ({ sub: owner, iss: `${fixture.baseUrl}/auth/v1`, role: 'authenticated', exp: 9999999999 })

it.each(['https://saytu-yef.xelltekk.com', 'https://example.supabase.co', 'http://localhost:55321',
  'http://127.0.0.1:55321@evil.test', 'http://127.0.0.1.evil.test:55321', 'http://127.0.0.1:55321/path',
  'http://127.0.0.1:55321?url=evil', 'http://127.0.0.1:65536', 'http://127.0.0.1:80'])('refuses nonlocal or ambiguous target %s', (target) => {
  expect(() => localTarget(target)).toThrow('Cible refusee')
})
it('accepts the literal local target, without a remote fallback', () => {
  expect(localTarget(fixture.baseUrl)).toBe(fixture.baseUrl)
  expect(validateFixture(fixture, 'smoke', decode).accounts).toHaveLength(1)
})
it('requires the local JWT issuer, subject and sufficient lifetime', () => {
  expect(() => validateFixture(fixture, 'smoke', () => ({ ...decode(), iss: 'https://remote/auth/v1' }))).toThrow('Session locale')
  expect(() => validateFixture(fixture, 'smoke', () => ({ ...decode(), sub: cashier }))).toThrow('Session locale')
  expect(() => validateFixture(fixture, 'smoke', () => ({ ...decode(), exp: 100 }), 90)).toThrow('Session locale')
})
it('rejects a service-role key or session and duplicated actors', () => {
  expect(() => validateFixture({ ...fixture, apiKey: 'sb_secret_test' }, 'smoke', decode)).toThrow('cle privilegiee')
  expect(() => validateFixture(fixture, 'smoke', () => ({ ...decode(), role: 'service_role' }))).toThrow('Session locale')
  expect(() => validateFixture({ ...fixture, accounts: [account, account] }, 'smoke', decode)).toThrow('Compte fictif')
})
it('does not permit a hundred-user run on a tiny dataset', () => {
  expect(() => validateFixture(fixture, 'shops100', decode)).toThrow('volume cible')
  expect(() => loadPlan('production')).toThrow('Profil')
  expect(loadPlan('shops100').peak).toBe(100)
  expect(loadPlan('cashiers300').peak).toBe(300)
  expect(loadPlan('smoke').iterations).toBe(5)
})
it('requires a matching marker and exact actor/shop/role before load', () => {
  const marker = { ...fixture, ownerId: owner, actorId: owner, role: 'admin' }
  expect(identityMatches(marker, fixture, account)).toBe(true)
  expect(identityMatches({ ...marker, runId: cashier }, fixture, account)).toBe(false)
  expect(identityMatches({ ...marker, role: 'cashier' }, fixture, account)).toBe(false)
})
it('bounds catalogue responses and rejects any foreign product', () => {
  const page = { ownerId: owner, totalVariants: 10, groupIds: [product], products: [{ user_id: owner }] }
  expect(catalogueMatches(page, fixture, account)).toBe(true)
  expect(catalogueMatches({ ...page, products: [{ user_id: cashier }] }, fixture, account)).toBe(false)
  expect(catalogueMatches({ ...page, products: Array(49).fill({ user_id: owner }) }, fixture, account)).toBe(false)
})
it('checks personal cashier reports, annual counts and thin responses', () => {
  const report = { ownerId: owner, salesCount: 20, appliedSellerId: null, monthlyData: Array(12).fill({}), topProducts: [] }
  expect(reportMatches(report, account)).toBe(true)
  expect(reportMatches({ ...report, allProducts: [] }, account)).toBe(false)
  expect(reportMatches({ ...report, salesCount: 19 }, account)).toBe(false)
  const member = { ...account, actorId: cashier, role: 'cashier' }
  expect(reportMatches(report, member)).toBe(false)
  expect(reportMatches({ ...report, appliedSellerId: cashier }, member)).toBe(true)
})
it('separates warmup ramps from each measured plateau', () => {
  expect(phaseLabel('shops100', 0)).toBe('ramp_5')
  expect(phaseLabel('shops100', 30)).toBe('hold_5')
  expect(phaseLabel('shops100', 90)).toBe('ramp_10')
  expect(phaseLabel('shops100', 450)).toBe('ramp_down')
  expect(phaseLabel('shops100', 480)).toBe('finished')
  expect(measuredPhases('shops100')).toEqual(['hold_5', 'hold_10', 'hold_25', 'hold_50', 'hold_100'])
  expect(measuredPhases('smoke')).toEqual(['smoke'])
})

const pilotFixture = () => {
  const accounts = Array.from({ length: 2 }, (_, shop) => {
    const ownerId = `10000000-0000-0000-0000-00000000000${shop + 1}`
    return Array.from({ length: 4 }, (_, member) => ({ ...account, ownerId,
      actorId: member ? `20000000-0000-0000-0000-0000000000${shop}${member}` : ownerId,
      accessToken: member ? `20000000-0000-0000-0000-0000000000${shop}${member}` : ownerId,
      role: member ? 'cashier' : 'admin', barcode: `LOAD-test-${shop}-1`,
    }))
  }).flat()
  return { ...fixture, shops: 2, variantsPerShop: 12, salesPerShop: 50, accounts }
}
const pilotDecode = (token: string) => ({ ...decode(), sub: token })

it('extends only the marked two-shop fixture and preserves actors/products/tokens', () => {
  const before = pilotFixture()
  const after = expandedFixture(before, pilotDecode)
  expect(after.variantsPerShop).toBe(1200)
  expect(after.salesPerShop).toBe(18250)
  expect(after.accounts.map(({ expectedSales }: { expectedSales: number }) => expectedSales)).toEqual([18250, 6084, 6083, 6083, 18250, 6084, 6083, 6083])
  expect(after.accounts[1].actorId).toBe(before.accounts[1].actorId)
  expect(after.accounts[1].productId).toBe(before.accounts[1].productId)
  expect(before.variantsPerShop).toBe(12)
  expect(() => expandedFixture({ ...before, shops: 3 }, pilotDecode)).toThrow()
  expect(() => expandedFixture({ ...before, accounts: before.accounts.filter((_, index) => index !== 3) }, pilotDecode)).toThrow('Trois caissiers')
})

it('keeps pilot guardrails distinct from the hundred-shop target', () => {
  const before = pilotFixture()
  expect(() => validateFixture(before, 'owners2', pilotDecode)).toThrow('pilote exige')
  const after = expandedFixture(before, pilotDecode)
  expect(validateFixture(after, 'owners2', pilotDecode).accounts).toHaveLength(2)
  expect(validateFixture(after, 'cashiers6', pilotDecode).accounts).toHaveLength(6)
  expect(() => validateFixture(after, 'shops100', pilotDecode)).toThrow('volume cible')
  expect(() => validateFixture(after, 'cashiers300', pilotDecode)).toThrow('volume cible')
  expect(loadPlan('owners2').vus).toBe(2)
  expect(loadPlan('cashiers6').vus).toBe(6)
  expect(measuredPhases('cashiers6')).toEqual(['cashiers6'])
  expect(phaseLabel('owners2', 119)).toBe('owners2')
  expect(phaseLabel('owners2', 120)).toBe('finished')
})

it('makes fixture growth additive, guarded and transactional rather than resetting old evidence', () => {
  const before = pilotFixture()
  const statement = expansionSql(before, expandedFixture(before, pilotDecode))
  expect(statement).toMatch(/^BEGIN;/)
  expect(statement).toContain('pg_advisory_xact_lock')
  expect(statement).toContain('load_lab.identity')
  expect(statement).toContain('generate_series(13,1200)')
  expect(statement).toContain('generate_series(51,18250)')
  expect(statement).toContain('ON CONFLICT(id) DO NOTHING')
  expect(statement).toContain('ENABLE TRIGGER USER')
  expect(statement).not.toMatch(/\b(?:DELETE|TRUNCATE|DROP TABLE)\b/)
})
