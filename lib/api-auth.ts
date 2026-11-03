import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type Role } from '@/lib/session-token'
import { findUserById, type UserRecord } from '@/lib/server/users'

// The single place the server decides who is making a request. Every API
// route goes through getSession(), so replacing this login system later (e.g.
// with Supabase Auth) means changing this file and app/api/auth/* only.

export interface ApiSession {
  id: string
  role: Role
  /** The student this account is linked to (parent / student roles). */
  studentId: string | null
  /** The team this account is linked to (coach role). */
  teamId: string | null
  academies: string[]
  user: UserRecord
}

// Every API request used to read the user row before doing anything else, a
// full database round trip on top of the request's own queries. A short cache
// removes that wait on page-to-page navigation. The trade-off is that disabling
// an account or changing its role can take up to USER_CACHE_MS to reach a
// server instance that has the old row cached. A cached row whose session
// version differs from the cookie's is never trusted: it is re-read, so a
// password change (which re-issues the cookie) takes effect at once.
const USER_CACHE_MS = 10_000
const userCache = new Map<string, { user: UserRecord | null; at: number }>()

async function cachedUser(id: string, ver: number): Promise<UserRecord | null> {
  const hit = userCache.get(id)
  if (hit && Date.now() - hit.at < USER_CACHE_MS && hit.user && hit.user.session_version === ver) return hit.user
  const user = await findUserById(id)
  userCache.set(id, { user, at: Date.now() })
  if (userCache.size > 500) userCache.clear()
  return user
}

/**
 * The signed-in user, or null.
 *
 * The cookie's signature proves the server issued it; the user row is then
 * re-read so a disabled account, a changed role or a password reset takes
 * effect on the very next request rather than when the cookie expires.
 * Memoised per request with React's cache().
 */
export const getSession = cache(async (): Promise<ApiSession | null> => {
  const store = await cookies()
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value)
  if (!payload) return null

  let user: UserRecord | null
  try {
    user = await cachedUser(payload.uid, payload.ver)
  } catch (err) {
    // Fail closed: if the database can't confirm the account, nobody is signed in.
    console.error('[api-auth] session lookup failed:', err instanceof Error ? err.message : err)
    return null
  }
  if (!user || user.disabled || user.session_version !== payload.ver) return null

  return {
    id: user.id,
    role: user.role,
    studentId: user.student_id,
    teamId: user.team_id,
    academies: user.academies,
    user,
  }
})

/** Reads just the role, or null if not logged in. */
export async function getSessionRole(): Promise<Role | null> {
  return (await getSession())?.role ?? null
}

/** True if the session's role is one of `allowed`. */
export async function requireRole(...allowed: Role[]): Promise<boolean> {
  const role = await getSessionRole()
  return role !== null && allowed.includes(role)
}

export async function isAdminRequest(): Promise<boolean> {
  return requireRole('admin')
}

/** Issue (or re-issue) the session cookie for a user. Route handlers only. */
export async function setSessionCookie(user: Pick<UserRecord, 'id' | 'role' | 'session_version'>): Promise<void> {
  const token = await signSession({
    uid: user.id,
    role: user.role,
    ver: user.session_version,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  })
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
}
