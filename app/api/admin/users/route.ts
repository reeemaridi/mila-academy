import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { readJson, dbError, badRequest, unauthorized } from '@/lib/api-fields'
import { hashPassword, passwordProblem } from '@/lib/server/passwords'
import { toPublic, type UserRecord } from '@/lib/server/users'
import { userValues, temporaryPassword, isDuplicateEmail } from './validate'

export async function GET() {
  if (!(await isAdminRequest())) return unauthorized()

  const { data, error } = await getSupabaseAdmin()
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return dbError('users.list', error)
  return NextResponse.json({ data: (data as UserRecord[]).map(toPublic) })
}

// Body: { email, name, role, academies, team_id?, student_id?, password? }
// Without a password a temporary one is generated. Either way the new user
// must choose their own password on first sign-in, and the temporary one is
// returned exactly once, here, for the admin to pass on.
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) return unauthorized()

  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')

  const result = userValues(body, false)
  if ('error' in result) return badRequest(result.error)

  const given = typeof body.password === 'string' && body.password !== '' ? body.password : null
  if (given) {
    const problem = passwordProblem(given)
    if (problem) return badRequest(problem)
  }
  const password = given ?? temporaryPassword()

  const { data, error } = await getSupabaseAdmin()
    .from('app_users')
    .insert({ ...result.values, password_hash: await hashPassword(password), must_change_password: true })
    .select('*')
    .single()

  if (isDuplicateEmail(error)) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
  }
  if (error) return dbError('users.create', error)
  return NextResponse.json({ data: toPublic(data as UserRecord), temporaryPassword: password }, { status: 201 })
}
