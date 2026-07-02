import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createResponseCookieBridge } from '@/lib/supabase/responseCookies'

export const dynamic = 'force-dynamic'
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' }

type SessionBody = {
  accessToken?: string
  refreshToken?: string
}

export async function GET() {
  const supabase = await createClient()
  const [{ data: sessionData }, { data: userData, error: userError }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ])

  const session = sessionData.session
  const user = userData.user

  if (!session || !user || userError) {
    return new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    })
  }

  return NextResponse.json(
    {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    },
    {
      headers: noStoreHeaders,
    }
  )
}

export async function POST(request: Request) {
  let body: SessionBody

  try {
    body = (await request.json()) as SessionBody
  } catch {
    return NextResponse.json({ error: 'Requete invalide.' }, { status: 400, headers: noStoreHeaders })
  }

  if (!body.accessToken || !body.refreshToken) {
    return NextResponse.json(
      { error: 'Session incomplete.' },
      { status: 400, headers: noStoreHeaders }
    )
  }

  const cookieStore = await cookies()
  const responseCookieBridge = createResponseCookieBridge(cookieStore)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: responseCookieBridge.cookies,
    }
  )

  const { error } = await supabase.auth.setSession({
    access_token: body.accessToken,
    refresh_token: body.refreshToken,
  })

  if (error) {
    console.warn('auth_session_sync_failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    })

    return responseCookieBridge.apply(
      NextResponse.json({ error: 'Impossible de synchroniser la session.' }, { status: 400, headers: noStoreHeaders })
    )
  }

  return responseCookieBridge.apply(
    NextResponse.json({ ok: true }, { headers: noStoreHeaders })
  )
}
