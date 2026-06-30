import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSafeRedirectPath } from '@/lib/authRedirect'
import { getLoginErrorMessage } from '@/lib/authErrors'

export const dynamic = 'force-dynamic'

type LoginBody = {
  email?: string
  password?: string
  next?: string
}

export async function POST(request: Request) {
  let body: LoginBody

  try {
    body = (await request.json()) as LoginBody
  } catch {
    return NextResponse.json(
      { error: 'Requête invalide.' },
      { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: 'Email et mot de passe requis.' },
      { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({
    email: body.email.trim().toLowerCase(),
    password: body.password,
  })

  if (error) {
    console.warn('auth_login_failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    })

    return NextResponse.json(
      { error: getLoginErrorMessage(error) },
      { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  return NextResponse.json(
    {
      redirectTo: getSafeRedirectPath(body.next),
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
