import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidateSite } from '@/lib/server/revalidate'
import { pick, readJson, dbError, badRequest, unauthorized } from '@/lib/api-fields'

export const TESTIMONIALS_FIELDS = ['quote', 'name', 'initials', 'role', 'rating', 'sort_order'] as const

export async function GET() {
  if (!(await isAdminRequest())) return unauthorized()

  const { data, error } = await getSupabaseAdmin()
    .from('testimonials')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return dbError('testimonials.list', error)
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) return unauthorized()

  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')

  if (typeof body.quote !== 'string' || !body.quote.trim() || typeof body.name !== 'string' || !body.name.trim()) {
    return badRequest('quote and name are required')
  }

  if (Object.hasOwn(body, 'rating') && !(Number.isInteger(body.rating) && (body.rating as number) >= 1 && (body.rating as number) <= 5)) {
    return badRequest('Rating must be a whole number from 1 to 5')
  }

  const { data, error } = await getSupabaseAdmin()
    .from('testimonials')
    .insert(pick(body, TESTIMONIALS_FIELDS))
    .select()
    .single()

  if (error) return dbError('testimonials.create', error)
  revalidateSite()
  return NextResponse.json({ data }, { status: 201 })
}
