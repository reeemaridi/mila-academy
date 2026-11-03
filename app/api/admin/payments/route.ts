import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { readJson, dbError, badRequest, unauthorized } from '@/lib/api-fields'
import { isUuid } from '@/lib/server/documents'
import { PAYMENT_COLUMNS, paymentAccess, paymentRowProblem } from '@/lib/server/payments'

const forbidden = () => NextResponse.json({ error: 'Forbidden' }, { status: 403 })

// GET /api/admin/payments?student_id=<uuid>  → that student's payment records, newest period first
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const studentId = req.nextUrl.searchParams.get('student_id')
  if (!isUuid(studentId)) return badRequest('student_id is required')
  if (!(await paymentAccess(session, studentId)).view) return forbidden()

  const { data, error } = await getSupabaseAdmin()
    .from('payments').select(PAYMENT_COLUMNS).eq('student_id', studentId)
    .order('period_label', { ascending: false })
  if (error) return dbError('payments.list', error)
  return NextResponse.json({ data })
}

// POST { student_id, period_type, period_label, amount, status?, method?, paid_date?, notes? }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')
  const studentId = body.student_id
  if (!isUuid(studentId)) return badRequest('student_id is required')
  if (!(await paymentAccess(session, studentId)).edit) return forbidden()

  for (const k of ['period_type', 'period_label', 'amount'] as const) {
    if (!Object.hasOwn(body, k)) return badRequest(`${k} is required`)
  }
  const values: Record<string, unknown> = {
    student_id: studentId,
    period_type: body.period_type,
    period_label: body.period_label,
    amount: body.amount,
    status: body.status ?? 'unpaid',
    method: body.method ?? null,
    paid_date: body.paid_date ?? null,
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
  }
  const problem = paymentRowProblem(values)
  if (problem) return badRequest(problem)

  // One record per student per period.
  const db = getSupabaseAdmin()
  const { data: existing } = await db.from('payments').select('id')
    .eq('student_id', studentId).eq('period_type', values.period_type as string).eq('period_label', values.period_label as string).limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'There is already a payment recorded for that period' }, { status: 409 })
  }

  // Marking paid without a date means "today".
  if (values.status !== 'unpaid' && !values.paid_date) values.paid_date = new Date().toISOString().slice(0, 10)

  const { data, error } = await db.from('payments').insert(values).select(PAYMENT_COLUMNS).single()
  if (error) return dbError('payments.create', error)
  return NextResponse.json({ data }, { status: 201 })
}
