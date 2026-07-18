import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getRequestOrigin } from '@/lib/requestOrigin'
import { clearSupabaseAuthCookies } from '@/lib/supabase/authCookies'
import {
  canCashierAccessPath,
  getRoleLandingPath,
  isCashierRestrictedRoute,
  normalizeAccountRole,
} from '@/lib/accountRoles'

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/forgot-password', '/auth/callback', '/auth/reset-password', '/account-status']
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
} as const

function applySecurityHeaders(response: NextResponse) {
  Object.entries(SECURITY_HEADERS).forEach(([name, value]) => {
    response.headers.set(name, value)
  })

  return response
}

function buildRedirectResponse(request: NextRequest, pathname: string) {
  const url = new URL(pathname, getRequestOrigin(request))
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return applySecurityHeaders(NextResponse.next())
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  let user: User | null = null

  try {
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.warn('middleware_auth_get_user_failed', {
        code: error.code,
        status: error.status,
        message: error.message,
      })

      clearSupabaseAuthCookies(
        request.cookies.getAll().map(({ name }) => name),
        (name) => response.cookies.set(name, '', { path: '/', maxAge: 0 })
      )
    }

    user = currentUser
  } catch (error) {
    console.warn('middleware_auth_get_user_failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    })

    clearSupabaseAuthCookies(
      request.cookies.getAll().map(({ name }) => name),
      (name) => response.cookies.set(name, '', { path: '/', maxAge: 0 })
    )
  }

  if (!user) {
    const url = new URL('/login', getRequestOrigin(request))
    url.searchParams.set('next', pathname)
    const redirectResponse = NextResponse.redirect(url)
    clearSupabaseAuthCookies(
      request.cookies.getAll().map(({ name }) => name),
      (name) => redirectResponse.cookies.set(name, '', { path: '/', maxAge: 0 })
    )
    return applySecurityHeaders(redirectResponse)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,account_owner_id')
    .eq('id', user.id)
    .maybeSingle()

  const role = normalizeAccountRole(profile?.role)
  let accessStatus = 'active'

  try {
    const { data, error } = await supabase.rpc('current_account_access_status')
    if (error) {
      console.warn('middleware_account_access_status_failed', {
        code: error.code,
        message: error.message,
      })
    } else if (data === 'restricted') {
      accessStatus = 'restricted'
    }
  } catch (error) {
    console.warn('middleware_account_access_status_failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    })
  }

  if (accessStatus === 'restricted') {
    const redirectResponse = buildRedirectResponse(request, '/account-status')
    return applySecurityHeaders(redirectResponse)
  }

  if (role === 'cashier' && (isCashierRestrictedRoute(pathname) || !canCashierAccessPath(pathname))) {
    const redirectResponse = buildRedirectResponse(request, getRoleLandingPath(role))
    return applySecurityHeaders(redirectResponse)
  }

  return applySecurityHeaders(response)
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/inventory/:path*',
    '/sales/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/abroad/:path*',
    '/clients/:path*',
    '/suppliers/:path*',
    '/team/:path*',
  ],
}
