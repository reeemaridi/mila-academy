import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { readJson, badRequest, dbError } from '@/lib/api-fields'
import { hashPassword, passwordProblem } from '@/lib/server/passwords'
import { findUserById } from '@/lib/server/users'
import { verifyResetToken, fingerprint } from '@/lib/server/reset-token'

const BAD_LINK = 'This reset link is invalid or has expired. Request a new one.'

// Sets a new password from an emailed link. The link stops working as soon as
// the password changes (its fingerprint no longer matches), and every existing
// session is signed out by the version bump.
export async function POST(req: NextRequest) {
  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')

  const token = typeof body.token === 'string' ? body.token : ''
  const payload = token ? verifyResetToken(token) : null
  if (!payload) return badRequest(BAD_LINK)

  const problem = passwordProblem(body.password)
  if (problem) return badRequest(problem)

  const user = await findUserById(payload.uid).catch(() => null)
  if (!user || user.disabled || fingerprint(user.password_hash) !== payload.fp) return badRequest(BAD_LINK)

  const { error } = await getSupabaseAdmin()
    .from('app_users')
    .update({
      password_hash: await hashPassword(body.password as string),
      must_change_password: false,
      session_version: user.session_version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) return dbError('auth.reset', error)

  return NextResponse.json({ ok: true })
}
