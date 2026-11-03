import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { clearCoachScopeCache } from '@/lib/server/coach-scope'
import { COACH_FIELDS, pick, readJson, dbError, badRequest, unauthorized, notFound } from '@/lib/api-fields'

// Also used to archive/restore — pass { archived_at: <ISO string> } to archive,
// or { archived_at: null } to restore.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole('admin'))) return unauthorized()

  const { id } = await params
  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')

  const values = pick(body, COACH_FIELDS)
  if (Object.keys(values).length === 0) return badRequest('No updatable fields provided')

  const { data, error } = await getSupabaseAdmin()
    .from('coaches').update(values).eq('id', id).select().maybeSingle()
  if (error) return dbError('coaches.update', error)
  if (!data) return notFound('Coach not found')
  clearCoachScopeCache()
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole('admin'))) return unauthorized()

  const { id } = await params
  const { error, count } = await getSupabaseAdmin()
    .from('coaches').delete({ count: 'exact' }).eq('id', id)
  if (error) return dbError('coaches.delete', error)
  if (!count) return notFound('Coach not found')
  clearCoachScopeCache()
  return NextResponse.json({ ok: true })
}
