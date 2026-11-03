import { NextRequest, NextResponse } from 'next/server'
import { getSession, requireRole } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { STUDENT_FIELDS, pick, readJson, dbError, badRequest, unauthorized, stripPayments } from '@/lib/api-fields'
import { hashPassword, passwordProblem } from '@/lib/server/passwords'
import { toPublic, findUserByEmail, isValidEmail, normalizeEmail, type UserRecord } from '@/lib/server/users'
import { temporaryPassword, isDuplicateEmail } from '../users/validate'

// ?includeArchived=1 to also return archived students (default: active only)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin' && session?.role !== 'coach') return unauthorized()

  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === '1'

  let query = getSupabaseAdmin().from('students').select('*').order('name', { ascending: true })
  if (!includeArchived) query = query.is('archived_at', null)

  // A coach only sees their own team's players (or their academy's, if no
  // team is assigned yet) — enforced here, not just in the UI.
  if (session.role === 'coach') {
    query = session.teamId ? query.eq('team_id', session.teamId) : query.in('academy', session.academies)
  }

  const { data, error } = await query
  if (error) return dbError('students.list', error)
  // A coach without the payments permission never receives money fields.
  const hidePayments = session.role === 'coach' && !session.user.can_view_payments
  return NextResponse.json({ data: hidePayments ? (data ?? []).map(stripPayments) : data })
}

// Admin only. Optional `account: { email, role: 'parent' | 'student', password? }`
// also creates the sign-in for this student in the same step. The login starts
// with a temporary password (returned once) and must be changed on first sign-in.
export async function POST(req: NextRequest) {
  if (!(await requireRole('admin'))) return unauthorized()

  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')

  const { name, academy } = body
  if (typeof name !== 'string' || !name.trim()) {
    return badRequest('name is required')
  }
  if (academy !== 'MFA' && academy !== 'MBA') {
    return badRequest('academy must be MFA or MBA')
  }

  let account: { email: string; role: 'parent' | 'student'; password: string } | null = null
  if (body.account !== undefined && body.account !== null) {
    const a = body.account as Record<string, unknown>
    const email = typeof a.email === 'string' ? normalizeEmail(a.email) : ''
    if (!isValidEmail(email)) return badRequest('A valid login email is required')
    if (a.role !== 'parent' && a.role !== 'student') return badRequest('Login role must be parent or student')
    const given = typeof a.password === 'string' && a.password !== '' ? a.password : null
    if (given) {
      const problem = passwordProblem(given)
      if (problem) return badRequest(problem)
    }
    if (await findUserByEmail(email).catch(() => null)) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    account = { email, role: a.role, password: given ?? temporaryPassword() }
  }

  // Whitelisted: the body used to be inserted wholesale, so a caller could set
  // `id`, `created_at` or `archived_at` directly.
  const values = pick(body, STUDENT_FIELDS)
  values.name = name.trim()

  const db = getSupabaseAdmin()
  const { data, error } = await db.from('students').insert(values).select().single()
  if (error) return dbError('students.create', error)
  if (!account) return NextResponse.json({ data }, { status: 201 })

  const { data: user, error: userError } = await db
    .from('app_users')
    .insert({
      email: account.email,
      name: account.role === 'parent' ? (data.parent_name || `Parent of ${data.name}`) : data.name,
      role: account.role,
      academies: [data.academy],
      student_id: data.id,
      password_hash: await hashPassword(account.password),
      must_change_password: true,
    })
    .select('*')
    .single()

  if (userError) {
    // Don't leave a student with no login when one was asked for.
    await db.from('students').delete().eq('id', data.id)
    if (isDuplicateEmail(userError)) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    return dbError('students.create-account', userError)
  }
  return NextResponse.json({ data, user: toPublic(user as UserRecord), temporaryPassword: account.password }, { status: 201 })
}
