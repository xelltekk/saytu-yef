import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  let database: 'ok' | 'unavailable' = 'unavailable'
  let auth: 'ok' | 'unavailable' = 'unavailable'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const probe = async (path: string, method = 'GET') => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}${path}`, {
        method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}), cache: 'no-store', signal: AbortSignal.timeout(5_000),
      })
      if (!response.ok) return false
      return method === 'POST' ? await response.json() === true : true
    } catch { return false }
  }
  const [databaseOk, authOk] = await Promise.all([probe('/rest/v1/rpc/database_health', 'POST'), probe('/auth/v1/health')])
  database = databaseOk ? 'ok' : 'unavailable'
  auth = authOk ? 'ok' : 'unavailable'

  const healthy = database === 'ok' && auth === 'ok'
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      app: 'saytu-yef',
      dependencies: { database, auth },
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
