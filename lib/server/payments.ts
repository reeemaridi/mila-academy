import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ApiSession } from '@/lib/api-auth'
import { coachTeamIds, inCoachScope } from '@/lib/server/coach-scope'

// The payment ledger: one row per billing period of a student, either a whole
// month ("2026-06") or a single day / session ("2026-06-12"). It is the money
// counterpart of attendance, which is also recorded per day.

export type PeriodType = 'monthly' | 'per_session'
export type PayStatus = 'paid' | 'unpaid' | 'partial'
export type PayMethod = 'cash' | 'bank' | 'whatsapp'

export interface PaymentRow {
  id: string
  student_id: string
  period_type: PeriodType
  /** "YYYY-MM" for monthly, "YYYY-MM-DD" for per-session (daily) */
  period_label: string
  amount: number
  status: PayStatus
  paid_date: string | null
  method: PayMethod | null
  notes: string
}

export const PAYMENT_COLUMNS = 'id, student_id, period_type, period_label, amount, status, paid_date, method, notes'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** A message if the values are not valid for a ledger row, else null. Only checks the keys present. */
export function paymentRowProblem(v: Record<string, unknown>, type?: PeriodType): string | null {
  const t = (v.period_type as PeriodType | undefined) ?? type
  if (Object.hasOwn(v, 'period_type') && v.period_type !== 'monthly' && v.period_type !== 'per_session') return 'Billing must be monthly or per session'
  if (Object.hasOwn(v, 'period_label')) {
    const l = v.period_label
    if (typeof l !== 'string' || !(t === 'per_session' ? DAY.test(l) : MONTH.test(l))) {
      return t === 'per_session' ? 'Pick a date for a per-session payment' : 'Pick a month for a monthly payment'
    }
  }
  if (Object.hasOwn(v, 'amount')) {
    const n = v.amount
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1_000_000) return 'Amount must be a number from 0 to 1,000,000'
  }
  if (Object.hasOwn(v, 'status') && !['paid', 'unpaid', 'partial'].includes(v.status as string)) return 'Status must be paid, unpaid or partial'
  if (Object.hasOwn(v, 'method') && v.method !== null && !['cash', 'bank', 'whatsapp'].includes(v.method as string)) return 'Method must be cash, bank or whatsapp'
  if (Object.hasOwn(v, 'paid_date') && v.paid_date !== null && !DAY.test(String(v.paid_date))) return 'Paid date must look like 2026-06-12'
  if (Object.hasOwn(v, 'notes') && (typeof v.notes !== 'string' || v.notes.length > 300)) return 'Note is too long (300 characters)'
  return null
}

export interface PaymentAccess { view: boolean; edit: boolean }

/**
 *  - admin: view and edit everything.
 *  - coach an administrator allowed (can_view_payments): view and edit, for
 *    students in their own teams.
 *  - parent / student: view their own record only.
 */
export async function paymentAccess(session: ApiSession, studentId: string): Promise<PaymentAccess> {
  if (session.role === 'admin') return { view: true, edit: true }

  if (session.role === 'coach' && session.user.can_view_payments) {
    const { data } = await getSupabaseAdmin().from('students').select('team_id, academy').eq('id', studentId).maybeSingle()
    if (!data) return { view: false, edit: false }
    const ok = inCoachScope(await coachTeamIds(session), session, data)
    return { view: ok, edit: ok }
  }

  if ((session.role === 'parent' || session.role === 'student') && session.studentId === studentId) {
    return { view: true, edit: false }
  }
  return { view: false, edit: false }
}
