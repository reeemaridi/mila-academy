import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { Role } from '@/lib/session-token'

export type Academy = 'MFA' | 'MBA'

/** An app_users row as stored, password hash included. Never send to a client. */
export interface UserRecord {
  id: string
  email: string
  password_hash: string
  role: Role
  name: string
  academies: Academy[]
  team_id: string | null
  student_id: string | null
  disabled: boolean
  must_change_password: boolean
  /** coaches only: may see payment information (column added by migration_payments_permission.sql; absent until it is run) */
  can_view_payments?: boolean
  session_version: number
  last_login_at: string | null
  created_at: string
  updated_at: string
}

/** What the API returns for a user — everything except the hash. */
export type PublicUser = Omit<UserRecord, 'password_hash'>

export const PUBLIC_USER_COLUMNS =
  'id, email, role, name, academies, team_id, student_id, disabled, must_change_password, session_version, last_login_at, created_at, updated_at'

export const ROLES: readonly Role[] = ['admin', 'coach', 'parent', 'student']
export const ACADEMIES: readonly Academy[] = ['MFA', 'MBA']

export function toPublic(u: UserRecord): PublicUser {
  const { password_hash: _hash, ...rest } = u
  return rest
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('app_users')
    .select('*')
    .ilike('email', normalizeEmail(email).replace(/[\\%_]/g, c => `\\${c}`))
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as UserRecord | null
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('app_users')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as UserRecord | null
}

/** Enabled admins, optionally excluding one id — used to stop the last admin being removed. */
export async function countActiveAdmins(excludingId?: string): Promise<number> {
  let q = getSupabaseAdmin()
    .from('app_users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('disabled', false)
  if (excludingId) q = q.neq('id', excludingId)
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Shape the client keeps for rendering (lib/auth.ts SessionUser, minus UI state). */
export function sessionUserFor(u: UserRecord | PublicUser) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    name: u.name,
    academies: u.academies,
    teamId: u.team_id,
    studentId: u.student_id ?? undefined,
    mustChangePassword: u.must_change_password,
    canViewPayments: u.role === 'admin' || !!u.can_view_payments,
  }
}
