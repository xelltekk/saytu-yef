import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
    body = await request.json() as SignupBody
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: noStoreHeaders })
  }

  const fullName = body.fullName?.trim() ?? ''
  const businessName = body.businessName?.trim() ?? ''
  const email = body.email?.trim().toLowerCase() ?? ''
  const password = body.password ?? ''

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: 'Nom, email et mot de passe requis.' }, { status: 400, headers: noStoreHeaders })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400, headers: noStoreHeaders })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        business_name: businessName,
      },
    },
  })

  if (error) {
    const message = error.message === 'User already registered'
      ? 'Cet email est déjà utilisé. Connectez-vous.'
      : error.message.toLowerCase().includes('password')
        ? 'Le mot de passe ne respecte pas les exigences de sécurité.'
        : 'Impossible de créer le compte pour le moment. Réessayez.'
    return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders })
  }

  if (data.user && data.user.identities?.length === 0) {
    return NextResponse.json(
      { error: 'Cet email est déjà utilisé. Connectez-vous.' },
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
