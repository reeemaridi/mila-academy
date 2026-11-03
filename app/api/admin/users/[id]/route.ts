import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { readJson, dbError, badRequest, unauthorized, notFound } from '@/lib/api-fields'
import { PUBLIC_USER_COLUMNS, findUserById, countActiveAdmins } from '@/lib/server/users'
import { userValues, isDuplicateEmail } from '../validate'
import { removeOwnerDocuments } from '@/lib/server/documents'

const conflict = (error: string) => NextResponse.json({ error }, { status: 409 })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (session?.role !== 'admin') return unauthorized()

  const { id } = await params
  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')

  const target = await findUserById(id).catch(() => null)
  if (!target) return notFound('User not found')

  const result = userValues(body, true, (body.role as never) ?? target.role)
  if ('error' in result) return badRequest(result.error)
  const values = result.values
  if (Object.keys(values).length === 0) return badRequest('No updatable fields provided')

  const losesAdmin =
    target.role === 'admin' && !target.disabled &&
    ((values.role !== undefined && values.role !== 'admin') || values.disabled === true)

  if (losesAdmin && id === session.id) {
    return conflict('You cannot remove your own admin access or disable yourself. Ask another admin.')
  }
  if (losesAdmin && (await countActiveAdmins(id)) === 0) {
    return conflict('This is the last active admin. Make someone else an admin first.')
  }

  // A role change or disabling signs the user out of every device at once.
  if ((values.role !== undefined && values.role !== target.role) || values.disabled === true) {
    values.session_version = target.session_version + 1
  }
  values.updated_at = new Date().toISOString()

  const { data, error } = await getSupabaseAdmin()
    .from('app_users')
    .update(values)
    .eq('id', id)
    .select(PUBLIC_USER_COLUMNS)
    .maybeSingle()

  if (isDuplicateEmail(error)) return conflict('A user with this email already exists')
  if (error) return dbError('users.update', error)
  if (!data) return notFound('User not found')
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (session?.role !== 'admin') return unauthorized()

  const { id } = await params
  if (id === session.id) return conflict('You cannot delete your own account.')

  const target = await findUserById(id).catch(() => null)
  if (!target) return notFound('User not found')
  if (target.role === 'admin' && !target.disabled && (await countActiveAdmins(id)) === 0) {
    return conflict('This is the last active admin and cannot be deleted.')
  }

  await removeOwnerDocuments('user', id)
  const { error } = await getSupabaseAdmin().from('app_users').delete().eq('id', id)
  if (error) return dbError('users.delete', error)
  return NextResponse.json({ ok: true })
}
