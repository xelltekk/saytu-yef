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

type SignupError = {
  code?: string
  message?: string
  status?: number
}

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' }

function getSignupErrorResponse(error: SignupError): { message: string; status: number } {
  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''
  const combined = `${code} ${message}`

  if (combined.includes('user already registered') || combined.includes('already registered')) {
    return { message: 'Cet email est deja utilise. Connectez-vous.', status: 409 }
  }

  if (combined.includes('over_email_send_rate_limit') || combined.includes('email rate limit')) {
    return {
      message:
        "Les emails de confirmation sont temporairement limites. Reessayez plus tard ou contactez l'administrateur pour activer le compte.",
      status: 429,
    }
  }

  if (combined.includes('signup is disabled') || combined.includes('signups not allowed')) {
    return {
      message: "L'inscription est temporairement desactivee. Contactez l'administrateur.",
      status: 503,
    }
  }

  if (combined.includes('invalid email')) {
    return { message: 'Adresse email invalide.', status: 400 }
  }

  if (combined.includes('password')) {
    return { message: 'Le mot de passe ne respecte pas les exigences de securite.', status: 400 }
  }

  return { message: 'Impossible de creer le compte pour le moment. Reessayez.', status: 400 }
}

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
