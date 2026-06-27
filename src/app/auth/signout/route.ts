import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getRequestOrigin } from '@/lib/requestOrigin'

async function signOut(request: Request) {
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
  await supabase.auth.signOut()

  const origin = getRequestOrigin(request)
  return NextResponse.redirect(`${origin}/login`)
}

export const GET = signOut
export const POST = signOut
