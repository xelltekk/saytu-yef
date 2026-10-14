const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const FIXTURE_KIND = 'saytu-load-read-v1'

export function localTarget(value) {
  const match = /^http:\/\/127\.0\.0\.1:(\d+)$/.exec(value ?? '')
  if (!match || Number(match[1]) < 1024 || Number(match[1]) > 65535) throw new Error('Cible refusee : seule une API locale 127.0.0.1 est autorisee.')
  return value
}

export function loadPlan(profile) {
  if (profile === 'smoke') return { peak: 1, seconds: 60, executor: 'per-vu-iterations', vus: 1, iterations: 5, maxDuration: '1m' }
  if (['owners2', 'cashiers6'].includes(profile)) {
    const peak = profile === 'owners2' ? 2 : 6
    return { peak, seconds: 120, executor: 'constant-vus', vus: peak, duration: '2m', gracefulStop: '20s' }
  }
  if (!['shops100', 'cashiers300'].includes(profile)) throw new Error('Profil de charge invalide')
  const stages = []
  const levels = profile === 'shops100' ? [5, 10, 25, 50, 100] : [5, 25, 50, 100, 200, 300]
  for (const target of levels) {
    stages.push({ target, duration: '30s' }, { target, duration: '1m' })
  }
  stages.push({ target: 0, duration: '30s' })
  return { peak: levels[levels.length - 1], seconds: levels.length * 90 + 30, executor: 'ramping-vus', startVUs: 0, stages, gracefulRampDown: '20s' }
}

export function phaseLabel(profile, seconds) {
  if (profile === 'smoke') return 'smoke'
  if (['owners2', 'cashiers6'].includes(profile)) return seconds < 120 ? profile : 'finished'
  const stages = loadPlan(profile).stages
  let elapsed = 0
  for (let index = 0; index < stages.length; index++) {
    const stage = stages[index]
    const duration = parseFloat(stage.duration) * (stage.duration.endsWith('m') ? 60 : 1)
    elapsed += duration
    if (seconds < elapsed) return stage.target === 0 ? 'ramp_down' : `${index % 2 ? 'hold' : 'ramp'}_${stage.target}`
  }
  return 'finished'
}

export function measuredPhases(profile) {
  if (['smoke', 'owners2', 'cashiers6'].includes(profile)) return [profile]
  return loadPlan(profile).stages.filter((_, index) => index % 2 === 1).map((stage) => `hold_${stage.target}`)
}

export function validateFixture(value, profile, decode, nowSeconds = Date.now() / 1000) {
  const baseUrl = localTarget(value.baseUrl)
  const plan = loadPlan(profile)
  if (value.kind !== FIXTURE_KIND || !UUID.test(value.runId) || !Array.isArray(value.accounts) || !value.accounts.length
    || !Number.isInteger(value.shops) || value.shops < 1 || value.shops > 100
    || !Number.isInteger(value.variantsPerShop) || value.variantsPerShop < 2 || value.variantsPerShop > 2000
    || !Number.isInteger(value.salesPerShop) || value.salesPerShop < 1 || value.salesPerShop > 20000) throw new Error('Jeu de test invalide')
  if (typeof value.apiKey !== 'string' || (!value.apiKey.startsWith('sb_publishable_') && decode(value.apiKey)?.role !== 'anon')) {
    throw new Error('Une cle publique locale est obligatoire; cle privilegiee refusee')
  }
  const actors = new Set()
  const owners = new Set()
  const cashiers = new Map()
  for (const account of value.accounts) {
    if (!UUID.test(account.actorId) || !UUID.test(account.ownerId) || !UUID.test(account.productId)
      || actors.has(account.actorId) || !['admin', 'cashier'].includes(account.role)
      || typeof account.barcode !== 'string' || !account.barcode.startsWith('LOAD-')
      || !Number.isInteger(account.expectedSales) || account.expectedSales < 0) throw new Error('Compte fictif invalide')
    const token = decode(account.accessToken)
    if (token?.sub !== account.actorId || token.role !== 'authenticated' || token.iss !== `${baseUrl}/auth/v1`
      || !Number.isFinite(token.exp) || token.exp < nowSeconds + plan.seconds + 600) throw new Error('Session locale invalide ou trop proche de son expiration')
    actors.add(account.actorId)
    if (account.role === 'admin') {
      if (account.actorId !== account.ownerId) throw new Error('Proprietaire fictif invalide')
      owners.add(account.ownerId)
    } else cashiers.set(account.ownerId, (cashiers.get(account.ownerId) ?? 0) + 1)
  }
  if (owners.size !== value.shops || [...cashiers.keys()].some((owner) => !owners.has(owner))) throw new Error('Boutiques fictives incompletes')
  const cashierProfile = ['cashiers6', 'cashiers300'].includes(profile)
  const accounts = value.accounts.filter((account) => account.role === (cashierProfile ? 'cashier' : 'admin'))
  if (['owners2', 'cashiers6'].includes(profile) && (value.shops !== 2 || value.variantsPerShop < 1200 || value.salesPerShop < 18250)) {
    throw new Error('Le pilote exige deux boutiques, 1200 variantes et 18250 ventes par boutique')
  }
  if (['shops100', 'cashiers300'].includes(profile) && (value.shops !== 100 || value.variantsPerShop < 1200 || value.salesPerShop < 18250)) {
    throw new Error('Le volume cible exige 100 boutiques, 600 groupes/1200 variantes et 18250 ventes par boutique')
  }
  if (accounts.length !== (cashierProfile ? value.shops * 3 : value.shops)
    || (cashierProfile && [...owners].some((owner) => cashiers.get(owner) !== 3))) throw new Error('Effectif du scenario incomplet')
  return { ...value, baseUrl, accounts, plan }
}

export function identityMatches(body, fixture, account) {
  return body?.kind === FIXTURE_KIND && body.runId === fixture.runId && body.ownerId === account.ownerId
    && body.actorId === account.actorId && body.role === account.role && body.shops === fixture.shops
    && body.variantsPerShop === fixture.variantsPerShop && body.salesPerShop === fixture.salesPerShop
}

export function catalogueMatches(body, fixture, account) {
  return body?.ownerId === account.ownerId && body.totalVariants === fixture.variantsPerShop
    && Array.isArray(body.groupIds) && body.groupIds.length > 0 && body.groupIds.length <= 24
    && Array.isArray(body.products) && body.products.length > 0 && body.products.length <= 48
    && body.products.every((product) => product.user_id === account.ownerId)
}

export function reportMatches(body, account) {
  return body?.ownerId === account.ownerId && body.salesCount === account.expectedSales
    && body.appliedSellerId === (account.role === 'cashier' ? account.actorId : null)
    && Array.isArray(body.monthlyData) && body.monthlyData.length === 12
    && Array.isArray(body.topProducts) && body.topProducts.length <= 10 && !('allProducts' in body)
}
