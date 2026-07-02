import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getRequestOrigin } from '@/lib/requestOrigin'
import { getSafeRedirectPath } from '@/lib/authRedirect'
import { createResponseCookieBridge } from '@/lib/supabase/responseCookies'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = getRequestOrigin(request)
  const code = searchParams.get('code')
  const redirectPath = getSafeRedirectPath(searchParams.get('next'))

  if (code) {
    const cookieStore = await cookies()
    const responseCookieBridge = createResponseCookieBridge(cookieStore)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: responseCookieBridge.cookies,
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const loginUrl = new URL('/login', origin)
      loginUrl.searchParams.set('error', 'oauth')
      loginUrl.searchParams.set('next', redirectPath)
      return responseCookieBridge.apply(NextResponse.redirect(loginUrl))
    }

    return responseCookieBridge.apply(NextResponse.redirect(`${origin}${redirectPath}`))
  }

  return NextResponse.redirect(`${origin}${redirectPath}`)
}
