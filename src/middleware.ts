import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/forgot-password', '/auth/callback', '/auth/reset-password']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Supabase stocke la session dans un cookie nommé sb-<project-ref>-auth-token
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] ?? ''
  const cookieName = `sb-${projectRef}-auth-token`

  const hasSession =
    request.cookies.has(cookieName) ||
    request.cookies.has('sb-access-token') ||
    // format alternatif selon la version de @supabase/ssr
    [...request.cookies.getAll()].some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

  if (!hasSession) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/inventory/:path*',
    '/sales/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/abroad/:path*',
  ],
}
