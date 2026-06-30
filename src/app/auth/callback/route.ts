import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getRequestOrigin } from '@/lib/requestOrigin'
import { getSafeRedirectPath } from '@/lib/authRedirect'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = getRequestOrigin(request)
  const code = searchParams.get('code')
  const redirectPath = getSafeRedirectPath(searchParams.get('next'))

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setAll: (list: any[]) => list.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options)),
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const loginUrl = new URL('/login', origin)
      loginUrl.searchParams.set('error', 'oauth')
      loginUrl.searchParams.set('next', redirectPath)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.redirect(`${origin}${redirectPath}`)
}
