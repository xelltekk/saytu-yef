import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPPORTED_CURRENCIES = new Set(['XOF', 'CNY', 'AED', 'EUR', 'USD', 'TRY', 'SAR'])

type CachedRate = {
  rate: number
  updatedAt: string
  nextUpdateAt: string | null
  source: string
  cachedAt: number
}

const rateCache = new Map<string, CachedRate>()
const CACHE_TTL = 6 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const base = (request.nextUrl.searchParams.get('base') ?? '').toUpperCase()

  if (!SUPPORTED_CURRENCIES.has(base)) {
    return NextResponse.json({ error: 'Devise non prise en charge.' }, { status: 400 })
  }

  if (base === 'XOF') {
    return NextResponse.json({
      base: 'XOF', target: 'XOF', rate: 1,
      updatedAt: new Date().toISOString(), nextUpdateAt: null, source: 'Taux fixe XOF',
    })
  }

  const cached = rateCache.get(base)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json({ base, target: 'XOF', ...cached, cached: true })
  }

  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Service de change indisponible (${response.status})`)

    const payload = (await response.json()) as {
      result?: string; rates?: Record<string, number>; time_last_update_utc?: string
      time_next_update_utc?: string; provider?: string
    }
    const rate = payload.rates?.XOF
    if (payload.result !== 'success' || !Number.isFinite(rate) || !rate || rate <= 0) {
      throw new Error('Taux XOF invalide')
    }

    const value: CachedRate = {
      rate,
      updatedAt: payload.time_last_update_utc ? new Date(payload.time_last_update_utc).toISOString() : new Date().toISOString(),
      nextUpdateAt: payload.time_next_update_utc ? new Date(payload.time_next_update_utc).toISOString() : null,
      source: payload.provider ?? 'ExchangeRate-API',
      cachedAt: Date.now(),
    }
    rateCache.set(base, value)
    return NextResponse.json({ base, target: 'XOF', ...value, cached: false })
  } catch (error) {
    if (cached) return NextResponse.json({ base, target: 'XOF', ...cached, cached: true, stale: true })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Conversion indisponible.' },
      { status: 503 }
    )
  }
}
