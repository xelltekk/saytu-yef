import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  let database: 'ok' | 'unavailable' = 'unavailable'

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
    database = response.ok ? 'ok' : 'unavailable'
  } catch {
    database = 'unavailable'
  }

  const healthy = database === 'ok'
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      app: 'saytu-yef',
      dependencies: { database },
      environment: process.env.NODE_ENV ?? 'unknown',
      uptime: Math.round(process.uptime()),
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
