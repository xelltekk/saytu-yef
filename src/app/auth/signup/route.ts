import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSignupErrorResponse } from '@/lib/authErrors'
import { getRequestOrigin } from '@/lib/requestOrigin'

export const dynamic = 'force-dynamic'

type SignupBody = {
  fullName?: string
  businessName?: string
  email?: string
  password?: string
}

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' }

export async function POST(request: Request) {
  let body: SignupBody
  try {
    body = (await request.json()) as SignupBody
  } catch {
    return NextResponse.json({ error: 'Requete invalide.' }, { status: 400, headers: noStoreHeaders })
  }

  const fullName = body.fullName?.trim() ?? ''
  const businessName = body.businessName?.trim() ?? ''
  const email = body.email?.trim().toLowerCase() ?? ''
  const password = body.password ?? ''

  if (!fullName || !email || !password) {
    return NextResponse.json(
      { error: 'Nom, email et mot de passe requis.' },
      { status: 400, headers: noStoreHeaders }
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Le mot de passe doit contenir au moins 8 caracteres.' },
      { status: 400, headers: noStoreHeaders }
    )
  }

  const origin = getRequestOrigin(request)

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: fullName,
        business_name: businessName,
      },
    },
  })

  if (error) {
    console.warn('auth_signup_failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    })

    const { message, status } = getSignupErrorResponse(error)
    return NextResponse.json({ error: message }, { status, headers: noStoreHeaders })
  }

  if (data.user && data.user.identities?.length === 0) {
    return NextResponse.json(
      { error: 'Cet email est deja utilise. Connectez-vous.' },
      { status: 409, headers: noStoreHeaders }
    )
  }

  return NextResponse.json(
    {
      requiresEmailConfirmation: !data.session,
      redirectTo: data.session ? '/dashboard' : '/login',
    },
    { headers: noStoreHeaders }
  )
}
