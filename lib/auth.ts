import { notifySessionChanged } from './session-events'

// ── Types ──────────────────────────────────────────────────────────────────────

export type Academy       = 'MFA' | 'MBA'
export type AcademyFilter = 'MFA' | 'MBA' | 'Both'
export type Role          = 'admin' | 'coach' | 'parent' | 'student'
export type Resource      = 'students' | 'attendance' | 'matches' | 'coaches' | 'teams' | 'payments' | 'ratings' | 'reports' | 'settings' | 'website' | 'users'
export type Action        = 'view' | 'edit' | 'create' | 'delete'

/**
 * Shape cached in localStorage `mila_user`, for rendering only (names, nav,
 * academy switcher). It is not what grants access: the server decides that
 * from the signed httpOnly `mila_session` cookie on every request.
 */
export interface SessionUser {
  id: string
  email: string
  role: Role
  name: string
  academies: Academy[]
  teamId?: string | null
  studentId?: string
  mustChangePassword?: boolean
  selectedAcademy: AcademyFilter
  loggedIn: true
}

/** What /api/auth/login, /me and /password return as `user`. */
type ServerUser = Omit<SessionUser, 'selectedAcademy' | 'loggedIn'>

// ── Keys ───────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'mila_user'

// ── Internal helpers ───────────────────────────────────────────────────────────

function defaultAcademy(academies: Academy[]): AcademyFilter {
  if (academies.includes('MFA') && academies.includes('MBA')) return 'Both'
  return academies[0] ?? 'MFA'
}

/** Cache the server's view of the user, keeping the academy filter if still valid. */
function storeSession(u: ServerUser): SessionUser {
  const previous = getCurrentUser()
  const keep = previous?.id === u.id && previous.selectedAcademy
    && (previous.selectedAcademy === 'Both' ? u.academies.length === 2 : u.academies.includes(previous.selectedAcademy))
  const session: SessionUser = {
    ...u,
    studentId: u.studentId ?? undefined,
    selectedAcademy: keep ? previous!.selectedAcademy : defaultAcademy(u.academies),
    loggedIn: true,
  }
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch {}
  notifySessionChanged()
  return session
}

function clearStoredSession(): void {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
  notifySessionChanged()
}

// ── Public API ─────────────────────────────────────────────────────────────────

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; error: string }

/**
 * Check credentials on the server. On success the server sets the signed
 * session cookie and this caches the user for the UI.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: body?.error ?? 'Sign-in failed.' }
    return { ok: true, user: storeSession(body.user as ServerUser) }
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection.' }
  }
}

/** End the session on the server and forget the cached user. */
export async function logout(): Promise<void> {
  clearStoredSession()
  try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
}

/**
 * Re-read the session from the server. Picks up changes an admin made to this
 * account (role, name, academies) and signs out a disabled/reset account.
 * Returns false when there is no valid session.
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' })
    if (res.status === 401) { clearStoredSession(); return false }
    if (!res.ok) return true // server trouble: keep the cached session rather than bounce the user
    const body = await res.json()
    storeSession(body.user as ServerUser)
    return true
  } catch {
    return true
  }
}

/** Change your own password. The server re-issues the session cookie. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<string | null> {
  const res = await fetch('/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return body?.error ?? 'Could not change the password.'
  storeSession(body.user as ServerUser)
  return null
}

/** Read the current session from localStorage. Returns null if not logged in. */
export function getCurrentUser(): SessionUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

/** Persist the selected academy filter without requiring a full re-login. */
export function setSelectedAcademy(filter: AcademyFilter): void {
  const user = getCurrentUser()
  if (!user) return
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, selectedAcademy: filter }))
  } catch {}
  notifySessionChanged()
  // Dashboard pages (students, matches, payments, attendance, coaches, home)
  // refilter their lists off this event. Dispatched here rather than from the
  // switcher button, so any caller of setSelectedAcademy keeps them in sync.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('mila_academy_changed'))
  }
}

/**
 * Return whether the given user may perform `action` on `resource`.
 * admin always returns true.
 */
export function hasAccess(resource: Resource, action: Action, user: SessionUser): boolean {
  switch (user.role) {
    case 'admin':
      return true

    case 'coach':
      // Coaches cannot see financial data, the website editor, or accounts
      if (resource === 'payments') return false
      if (resource === 'settings') return false
      if (resource === 'website')  return false
      if (resource === 'users')    return false
      // Team records are admin-owned: a coach sees them but cannot change
      // which teams exist or who runs them. /api/admin/teams enforces this too.
      if (resource === 'teams')    return action === 'view'
      // Coaches can view & manage everything else for their teams
      return true

    case 'parent':
      // Parents get read-only access to their child's data only
      if (resource === 'students')   return action === 'view'
      if (resource === 'attendance') return action === 'view'
      if (resource === 'ratings')    return action === 'view'
      if (resource === 'matches')    return action === 'view'
      if (resource === 'payments')   return action === 'view'
      return false

    case 'student':
      // Students get read-only access to their own profile areas, no payments
      if (resource === 'students')   return action === 'view'
      if (resource === 'attendance') return action === 'view'
      if (resource === 'ratings')    return action === 'view'
      if (resource === 'matches')    return action === 'view'
      return false

    default:
      return false
  }
}

/** True on the sign-in, forgot-password and reset-password pages, where a 401 is expected. */
export function isAuthPage(): boolean {
  return /^\/dashboard\/(login|forgot-password|reset-password)/.test(window.location.pathname)
}
