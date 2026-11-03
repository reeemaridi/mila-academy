import { NextRequest, NextResponse } from 'next/server'
import { getSession, requireRole } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { STUDENT_FIELDS, pick, readJson, dbError, badRequest, unauthorized, notFound } from '@/lib/api-fields'
import { removeOwnerDocuments } from '@/lib/server/documents'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params

  // Parents and students may only read the record they're linked to. Previously
  // this endpoint returned any student to any logged-in account, so a parent
  // could change the id in the URL and read another family's medical notes,
  // emergency contacts and payment status.
  if (session.role === 'parent' || session.role === 'student') {
    if (!session.studentId || session.studentId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data, error } = await getSupabaseAdmin().from('students').select('*').eq('id', id).maybeSingle()
  if (error) return dbError('students.get', error)
  if (!data) return notFound('Student not found')
  if (session.role === 'coach') {
    const ok = session.teamId ? data.team_id === session.teamId : session.academies.includes(data.academy)
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ data })
}

// Also used to archive/restore — pass { archived_at: <ISO string> } to archive,
// or { archived_at: null } to restore.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole('admin'))) return unauthorized()

  const { id } = await params
  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')

  // Whitelisted — an unfiltered update let a caller rewrite `id` or `created_at`.
  const values = pick(body, STUDENT_FIELDS)
  if (Object.keys(values).length === 0) return badRequest('No updatable fields provided')

  const { data, error } = await getSupabaseAdmin()
    .from('students').update(values).eq('id', id).select().maybeSingle()
  if (error) return dbError('students.update', error)
  if (!data) return notFound('Student not found')
  return NextResponse.json({ data })
}

// Permanent delete — admin only. A linked login is removed with the student.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole('admin'))) return unauthorized()

  const { id } = await params
  const db = getSupabaseAdmin()
  await removeOwnerDocuments('student', id)
  // Their linked logins go too, along with any files those accounts hold.
  const { data: logins } = await db.from('app_users').select('id').eq('student_id', id).in('role', ['parent', 'student'])
  for (const l of logins ?? []) await removeOwnerDocuments('user', l.id)
  await db.from('app_users').delete().eq('student_id', id).in('role', ['parent', 'student'])
  const { error, count } = await db
    .from('students').delete({ count: 'exact' }).eq('id', id)
  if (error) return dbError('students.delete', error)
  if (!count) return notFound('Student not found')
  return NextResponse.json({ ok: true })
}
