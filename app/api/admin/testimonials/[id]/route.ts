import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidateSite } from '@/lib/server/revalidate'
import { pick, readJson, dbError, badRequest, unauthorized, notFound } from '@/lib/api-fields'
import { TESTIMONIALS_FIELDS } from '../route'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return unauthorized()

  const { id } = await params
  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')

  // Only the fields actually sent. This used to write every column on every
  // PATCH, so updating one field blanked the rest of the row.
  const values = pick(body, TESTIMONIALS_FIELDS)
  if (Object.keys(values).length === 0) return badRequest('No updatable fields provided')
  if (Object.hasOwn(values, 'rating') && !(Number.isInteger(values.rating) && (values.rating as number) >= 1 && (values.rating as number) <= 5)) {
    return badRequest('Rating must be a whole number from 1 to 5')
  }

  const { data, error } = await getSupabaseAdmin()
    .from('testimonials')
    .update(values)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) return dbError('testimonials.update', error)
  if (!data) return notFound('Testimonial not found')
  revalidateSite()
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return unauthorized()

  const { id } = await params
  const { error, count } = await getSupabaseAdmin()
    .from('testimonials').delete({ count: 'exact' }).eq('id', id)

  if (error) return dbError('testimonials.delete', error)
  if (!count) return notFound('Testimonial not found')
  revalidateSite()
  return NextResponse.json({ ok: true })
}
