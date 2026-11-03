import { NextRequest, NextResponse, after } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { setSessionCookie } from '@/lib/api-auth'
import { readJson, badRequest } from '@/lib/api-fields'
import { verifyPassword, getDummyHash } from '@/lib/server/passwords'
import { findUserByEmail, sessionUserFor } from '@/lib/server/users'

// Brute-force brake: after MAX_FAILURES wrong passwords for one email (or from
// one address) inside WINDOW_MS, further attempts are refused until the window
// passes. In-memory, so it resets on restart and is per server instance — a
// speed bump, not a lockout policy.
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 8
const failures = new Map<string, { count: number; first: number }>()

function limited(key: string): boolean {
  const f = failures.get(key)
  if (!f) return false
  if (Date.now() - f.first > WINDOW_MS) { failures.delete(key); return false }
  return f.count >= MAX_FAILURES
}

function recordFailure(key: string): void {
  const f = failures.get(key)
  if (!f || Date.now() - f.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() })
  else f.count += 1
}

const invalid = () => NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })

export async function POST(req: NextRequest) {
  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) return badRequest('Email and password are required')

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const keys = [`e:${email}`, `ip:${ip}`]
  if (keys.some(limited)) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in 15 minutes.' },
      { status: 429 },
    )
  }

  let user
  try {
    user = await findUserByEmail(email)
  } catch (err) {
    console.error('[auth.login]', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Sign-in is unavailable right now — the database could not be reached.' },
      { status: 503 },
    )
  }

  const ok = await verifyPassword(password, user?.password_hash ?? (await getDummyHash()))
  if (!user || !ok) {
    keys.forEach(recordFailure)
    return invalid()
  }
  if (user.disabled) {
    return NextResponse.json({ error: 'This account has been disabled. Contact an administrator.' }, { status: 403 })
  }

  keys.forEach(k => failures.delete(k))
  await setSessionCookie(user)
  // Recorded after the response is sent: it is bookkeeping, and awaiting it
  // added a full database round trip to every sign-in.
  after(async () => {
    await getSupabaseAdmin()
      .from('app_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)
  })

  return NextResponse.json({ user: sessionUserFor(user) })
}
