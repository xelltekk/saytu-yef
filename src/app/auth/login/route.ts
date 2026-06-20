import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSafeRedirectPath } from '@/lib/authRedirect'

export const dynamic = 'force-dynamic'

type LoginBody = {
  email?: string
  password?: string
  next?: string
}

type LoginSessionPayload = {
  access_token: string
  refresh_token: string
}

function getFriendlyError(message: string) {
  if (message === 'Invalid login credentials') {
    return 'Email ou mot de passe incorrect.'
  }

  if (message === 'Email not confirmed') {
    return 'Veuillez confirmer votre email avant de vous connecter.'
  }

  return 'Impossible de se connecter pour le moment. Vérifiez votre connexion et réessayez.'
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

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  })

  if (error) {
    return NextResponse.json(
      { error: getFriendlyError(error.message) },
      { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  const sessionPayload =
    data.session?.access_token && data.session?.refresh_token
      ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }
      : null

  return NextResponse.json(
    {
      redirectTo: getSafeRedirectPath(body.next),
      session: sessionPayload satisfies LoginSessionPayload | null,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
