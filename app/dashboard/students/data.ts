// ── Types ──────────────────────────────────────────────────────────────────────

export interface StudentRow {
  id: string
  name: string
  dob: string
  nationality: string
  position: string
  jersey_number: number
  team_id: string
  academy: 'MFA' | 'MBA'
  blood_type: string
  allergies: string
  injuries: string
  doctor_contact: string
  insured?: boolean
  payment_type?: 'monthly' | 'per_session'
  photo_url?: string | null
  parent_name: string
  parent_phone: string
  parent_whatsapp: string
  emergency_contact: string
  payment_status: 'paid' | 'unpaid' | 'partial'
  payment_amount: number
  payment_due_date: string
  notes: string
  created_at: string
  attendance_rate: number
  overall_rating: number
  awards: string[]
  /** Set when the student has been archived; null/absent means active. */
  archived_at?: string | null
}

export interface Team {
  id: string
  name: string
  academy: 'MFA' | 'MBA'
}

export interface RatingEntry {
  id: string
  date: string
  coach: string
  technique: number
  fitness: number
  attitude: number
  teamwork: number
  overall: number
  notes: string
}

export interface AttendanceEntry {
  date: string
  status: 'present' | 'absent' | 'late'
}

export interface PaymentEntry {
  id: string
  month: string
  amount: number
  status: 'paid' | 'unpaid' | 'partial'
  paid_date: string
  method: 'cash' | 'bank' | 'whatsapp' | ''
}

// ── Teams ──────────────────────────────────────────────────────────────────────

// Teams and students now come from the database (/api/admin/teams and
// /api/admin/students); these stay as empty lists for the screens that have not
// been moved over yet.
export const TEAMS: Team[] = []

export function teamName(id: string) {
  return TEAMS.find((t) => t.id === id)?.name ?? id
}

// ── Base students ──────────────────────────────────────────────────────────────

export const BASE_STUDENTS: StudentRow[] = []

// ── History ───────────────────────────────────────────────────────────────────
//
// Attendance, ratings and payment history are not stored in the database yet,
// so there is nothing to generate: these return no entries (nothing is made up).

export function generateAttendance(_id: string, _rate: number): AttendanceEntry[] {
  return []
}

export function generateRatings(_id: string, _overallRating: number): RatingEntry[] {
  return []
}

// The billing periods the mock payment data covers. Exported so the Payments
// screen and the Reports exports agree on which months exist and which one is
// "current" — Reports used to hard-code the string 'June 2026', so every
// exported report was labelled June no matter when it was run.
export const PAYMENT_MONTHS = [
  'January 2026','February 2026','March 2026','April 2026','May 2026','June 2026',
] as const

/** The most recent billing period in the data set. */
export const CURRENT_PAYMENT_MONTH = PAYMENT_MONTHS[PAYMENT_MONTHS.length - 1]

export function generatePayments(_id: string, _currentStatus: StudentRow['payment_status']): PaymentEntry[] {
  return []
}

// ── Merge helpers ──────────────────────────────────────────────────────────────

export function loadAllStudents(): StudentRow[] {
  // Students staff added themselves (kept in this browser by older versions of
  // the dashboard) are always kept.
  if (typeof window === 'undefined') return BASE_STUDENTS
  try {
    const added = JSON.parse(localStorage.getItem('mila_students_added') ?? '[]') as StudentRow[]
    return [...BASE_STUDENTS, ...added]
  } catch {
    return BASE_STUDENTS
  }
}
