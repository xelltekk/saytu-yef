import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getRequestOrigin } from '@/lib/requestOrigin'
import { createResponseCookieBridge } from '@/lib/supabase/responseCookies'

async function signOut(request: Request) {
  const cookieStore = await cookies()
  const responseCookieBridge = createResponseCookieBridge(cookieStore)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: responseCookieBridge.cookies,
    }
  )
  await supabase.auth.signOut()

  const origin = getRequestOrigin(request)
  return responseCookieBridge.apply(NextResponse.redirect(`${origin}/login`))
}

export const GET = signOut
export const POST = signOut
