import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ApiSession } from '@/lib/api-auth'

// Which teams a coach account may work with.
//
// The coach's profile (the `coaches` row with the same email as their sign-in)
// lists their teams, and that list is the source of truth, so an administrator
// changes a coach's teams in one place. Without a matching profile the single
// team on the account is used; with neither, the coach is limited to their
// academies.

const TTL_MS = 10_000
const cache = new Map<string, { ids: string[] | null; at: number }>()

/** Forget cached team lists (called when a coach profile changes). */
export function clearCoachScopeCache(): void {
  cache.clear()
}

/** The team ids a coach is limited to, or null for "every team in their academies". */
export async function coachTeamIds(session: ApiSession): Promise<string[] | null> {
  const email = session.user.email.trim().toLowerCase()
  const hit = cache.get(email)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ids

  let ids: string[] | null = session.teamId ? [session.teamId] : null
  const { data } = await getSupabaseAdmin()
    .from('coaches')
    .select('team_ids')
    .ilike('email', email.replace(/[\%_]/g, c => `\${c}`))
    .is('archived_at', null)
    .limit(1)
    .maybeSingle()
  const profile = (data?.team_ids as string[] | undefined) ?? []
  if (profile.length > 0) ids = profile

  cache.set(email, { ids, at: Date.now() })
  if (cache.size > 200) cache.clear()
  return ids
}

/** Whether a coach may see a student with this team and academy. */
export function inCoachScope(
  ids: string[] | null,
  session: Pick<ApiSession, 'academies'>,
  student: { team_id: string | null; academy: string },
): boolean {
  return ids ? !!student.team_id && ids.includes(student.team_id) : session.academies.includes(student.academy as 'MFA' | 'MBA')
}
