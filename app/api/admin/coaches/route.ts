import { NextRequest, NextResponse } from 'next/server'
import { getSession, requireRole } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { COACH_FIELDS, pick, readJson, dbError, badRequest, unauthorized } from '@/lib/api-fields'
import { createCoachLogin, checkLoginEmail } from '@/lib/server/coach-account'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'admin' && session?.role !== 'coach') return unauthorized()

  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === '1'

  const db = getSupabaseAdmin()
  let query = db.from('coaches').select('*').order('name', { ascending: true })
  if (!includeArchived) query = query.is('archived_at', null)

  const { data, error } = await query
  if (error) return dbError('coaches.list', error)

  // Administrators also learn which coaches can already sign in (an account
  // with the coach's email exists), so a missing login is easy to spot.
  if (session.role === 'admin') {
    const { data: users } = await db.from('app_users').select('email').eq('role', 'coach')
    const withLogin = new Set((users ?? []).map(u => String(u.email).toLowerCase()))
    return NextResponse.json({
      data: (data ?? []).map(c => ({ ...c, has_login: withLogin.has(String(c.email ?? '').trim().toLowerCase()) })),
    })
  }
  return NextResponse.json({ data })
}

// Every coach is created together with a sign-in: the email is required, and a
// temporary password (shown once) is returned for the admin to pass on. If the
// sign-in can't be created, the profile isn't either.
export async function POST(req: NextRequest) {
  if (!(await requireRole('admin'))) return unauthorized()

  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return badRequest('name is required')
  }

  const email = await checkLoginEmail(typeof body.email === 'string' ? body.email : '')
  if (!email.ok) return NextResponse.json({ error: email.error }, { status: email.status })

  const values = pick(body, COACH_FIELDS)
  values.name = body.name.trim()
  values.email = email.email

  const db = getSupabaseAdmin()
  const { data, error } = await db.from('coaches').insert(values).select().single()
  if (error) return dbError('coaches.create', error)

  const login = await createCoachLogin(data, email.email)
  if (!login.ok) {
    await db.from('coaches').delete().eq('id', data.id)
    return NextResponse.json({ error: login.error }, { status: login.status })
  }
  return NextResponse.json({ data: { ...data, has_login: true }, user: login.user, temporaryPassword: login.temporaryPassword }, { status: 201 })
}
