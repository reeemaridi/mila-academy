import 'server-only'
import { randomBytes } from 'node:crypto'
import { ROLES, ACADEMIES, isValidEmail, normalizeEmail, type Academy } from '@/lib/server/users'
import type { Role } from '@/lib/session-token'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates a user body and returns the columns to write. With `partial`,
 * only fields present are checked (PATCH). `currentRole` is the role the row
 * will have after the write, used to drop links that don't apply to it — a
 * coach has a team, a parent/student has a student record, an admin neither.
 */
export function userValues(
  body: Record<string, unknown>,
  partial: boolean,
  currentRole?: Role,
): { values: Record<string, unknown> } | { error: string } {
  const values: Record<string, unknown> = {}
  const has = (k: string) => Object.hasOwn(body, k)

  if (!partial || has('email')) {
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
    if (!isValidEmail(email)) return { error: 'A valid email is required' }
    values.email = email
  }
  if (!partial || has('name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return { error: 'Name is required' }
    values.name = name.slice(0, 100)
  }
  if (!partial || has('role')) {
    if (!ROLES.includes(body.role as Role)) return { error: `Role must be one of: ${ROLES.join(', ')}` }
    values.role = body.role
  }
  if (!partial || has('academies')) {
    const list = Array.isArray(body.academies) ? body.academies : []
    const academies = ACADEMIES.filter(a => list.includes(a)) as Academy[]
    if (academies.length === 0) return { error: 'Pick at least one academy' }
    values.academies = academies
  }
  for (const k of ['team_id', 'student_id'] as const) {
    if (!has(k)) continue
    const v = body[k]
    if (v === null || v === '') { values[k] = null; continue }
    if (typeof v !== 'string' || !UUID.test(v)) return { error: `Invalid ${k === 'team_id' ? 'team' : 'student'}` }
    values[k] = v
  }
  if (has('disabled')) values.disabled = Boolean(body.disabled)
  if (has('can_view_payments')) values.can_view_payments = body.can_view_payments === true

  const role = (values.role as Role | undefined) ?? currentRole
  if (role === 'admin') { values.team_id = null; values.student_id = null }
  if (role === 'coach') values.student_id = null
  // Only coaches need the flag (admins always have access; families never do).
  if (role !== 'coach' && has('can_view_payments')) values.can_view_payments = false
  if (role === 'parent' || role === 'student') values.team_id = null

  return { values }
}

/** A readable temporary password, e.g. "mila-7f3k-q9x2". The user must change it on first sign-in. */
export function temporaryPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(8)
  let s = ''
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] % alphabet.length]
  return `mila-${s.slice(0, 4)}-${s.slice(4)}`
}

/** Postgres unique-violation — the lower(email) index. */
export function isDuplicateEmail(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}
