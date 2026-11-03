import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { hashPassword } from '@/lib/server/passwords'
import { findUserByEmail, isValidEmail, normalizeEmail, toPublic, type Academy, type UserRecord } from '@/lib/server/users'
import { temporaryPassword } from '@/app/api/admin/users/validate'

// A coach profile (the `coaches` table: bio, teams, salary…) and a sign-in (the
// `app_users` table) are separate records. They are linked by email: a coach
// "has a login" when an account with the coach's email exists.

export type CoachLoginResult =
  | { ok: true; user: ReturnType<typeof toPublic>; temporaryPassword: string }
  | { ok: false; status: number; error: string }

/** Whether a login can be made for this email right now (valid and unused). */
export async function checkLoginEmail(emailRaw: string): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  const email = normalizeEmail(emailRaw ?? '')
  if (!isValidEmail(email)) return { ok: false, status: 400, error: 'A valid email is needed to create a sign-in' }
  if (await findUserByEmail(email).catch(() => null)) return { ok: false, status: 409, error: 'A user with this email already exists' }
  return { ok: true, email }
}

/**
 * Creates the coach's sign-in with a temporary password they must change on
 * first use. One team → linked to it; several teams or none → academy-wide
 * (an account has a single team link, so it can't express "these three").
 */
export async function createCoachLogin(
  coach: { name: string; team_ids: string[] | null },
  emailRaw: string,
): Promise<CoachLoginResult> {
  const checked = await checkLoginEmail(emailRaw)
  if (!checked.ok) return checked

  const db = getSupabaseAdmin()
  const teamIds = coach.team_ids ?? []
  let academies: Academy[] = ['MFA', 'MBA']
  if (teamIds.length > 0) {
    const { data } = await db.from('teams').select('academy').in('id', teamIds)
    const found = [...new Set((data ?? []).map(t => t.academy as Academy))]
    if (found.length > 0) academies = found
  }

  const password = temporaryPassword()
  const { data, error } = await db
    .from('app_users')
    .insert({
      email: checked.email,
      name: coach.name,
      role: 'coach',
      academies,
      team_id: teamIds.length === 1 ? teamIds[0] : null,
      password_hash: await hashPassword(password),
      must_change_password: true,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, status: 409, error: 'A user with this email already exists' }
    console.error('[coach-account]', error.message)
    return { ok: false, status: 500, error: 'Something went wrong' }
  }
  return { ok: true, user: toPublic(data as UserRecord), temporaryPassword: password }
}
