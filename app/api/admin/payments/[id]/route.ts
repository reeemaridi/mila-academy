import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { pick, readJson, dbError, badRequest, unauthorized, notFound } from '@/lib/api-fields'
import { isUuid } from '@/lib/server/documents'
import { PAYMENT_COLUMNS, paymentAccess, paymentRowProblem, type PaymentRow } from '@/lib/server/payments'

const forbidden = () => NextResponse.json({ error: 'Forbidden' }, { status: 403 })
const EDITABLE = ['amount', 'status', 'method', 'paid_date', 'notes'] as const

async function load(id: string) {
  const { data } = await getSupabaseAdmin().from('payments').select(PAYMENT_COLUMNS).eq('id', id).maybeSingle()
  return (data as PaymentRow | null) ?? null
}

// PATCH { amount?, status?, method?, paid_date?, notes? } — the period itself isn't changed; delete and re-add instead.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  if (!isUuid(id)) return notFound('Payment not found')
  const row = await load(id)
  if (!row) return notFound('Payment not found')
  if (!(await paymentAccess(session, row.student_id)).edit) return forbidden()

  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')
  const values = pick(body, EDITABLE)
  if (Object.keys(values).length === 0) return badRequest('No updatable fields provided')
  const problem = paymentRowProblem(values, row.period_type)
  if (problem) return badRequest(problem)

  // Marking paid or partial with no date means "today"; marking unpaid clears it.
  const status = (values.status as string | undefined) ?? row.status
  if (status === 'unpaid') { values.paid_date = null; values.method = null }
  else if (values.status !== undefined && !values.paid_date && !row.paid_date) values.paid_date = new Date().toISOString().slice(0, 10)

  const { data, error } = await getSupabaseAdmin().from('payments').update(values).eq('id', id).select(PAYMENT_COLUMNS).single()
  if (error) return dbError('payments.update', error)
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  if (!isUuid(id)) return notFound('Payment not found')
  const row = await load(id)
  if (!row) return notFound('Payment not found')
  if (!(await paymentAccess(session, row.student_id)).edit) return forbidden()

  const { error } = await getSupabaseAdmin().from('payments').delete().eq('id', id)
  if (error) return dbError('payments.delete', error)
  return NextResponse.json({ ok: true })
}
