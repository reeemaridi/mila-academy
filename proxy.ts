import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/session-token'

const PUBLIC_PATHS = ['/dashboard/login', '/dashboard/forgot-password', '/dashboard/reset-password']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow the login page through
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()

  // A validly signed, unexpired session cookie (issued by /api/auth/login).
  // This is a cheap first gate with no database call; each API route still
  // re-checks the account itself via lib/api-auth.ts getSession().
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)
  if (session) return NextResponse.next()

  // It answers API calls with JSON — redirecting an API call to an HTML login
  // page would surface to fetch() as an unhelpful parse error.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.redirect(new URL('/dashboard/login', request.url))
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/admin/:path*'],
}
