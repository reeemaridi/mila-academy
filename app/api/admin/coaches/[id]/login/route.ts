import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { readJson, dbError, unauthorized, notFound } from '@/lib/api-fields'
import { createCoachLogin, checkLoginEmail } from '@/lib/server/coach-account'

// Give an existing coach profile a sign-in. Uses the profile's email, or the
// `email` in the body (which is then saved on the profile too). The temporary
// password is returned once, for the admin to pass on.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole('admin'))) return unauthorized()

  const { id } = await params
  const body = (await readJson(req)) ?? {}
  const db = getSupabaseAdmin()

  const { data: coach, error } = await db.from('coaches').select('id, name, email, team_ids').eq('id', id).maybeSingle()
  if (error) return dbError('coaches.login.get', error)
  if (!coach) return notFound('Coach not found')

  const email = typeof body.email === 'string' && body.email.trim() ? body.email : coach.email
  const checked = await checkLoginEmail(email ?? '')
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.status })

  const result = await createCoachLogin(coach, checked.email)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  // Keep the profile's email in step with the account that now belongs to it.
  if (coach.email?.trim().toLowerCase() !== checked.email) {
    await db.from('coaches').update({ email: checked.email }).eq('id', id)
  }
  return NextResponse.json({ user: result.user, temporaryPassword: result.temporaryPassword }, { status: 201 })
}
