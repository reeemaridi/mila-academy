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

// The real teams and students, filled in by setRoster() once the dashboard has
// fetched them (see hooks/useRoster.ts). These are the lists the Attendance,
// Ratings, Payments, Matches and Reports screens read. TEAMS is updated in
// place so every module that imported it sees the new contents.
export const TEAMS: Team[] = []
let realStudents: StudentRow[] = []

export function setRoster(teams: Team[], students: StudentRow[]): void {
  TEAMS.length = 0
  TEAMS.push(...teams)
  realStudents = students
}

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
  if (typeof window === 'undefined') return [...BASE_STUDENTS, ...realStudents]
  try {
    const added = JSON.parse(localStorage.getItem('mila_students_added') ?? '[]') as StudentRow[]
    const known = new Set(realStudents.map(s => s.id))
    return [...BASE_STUDENTS, ...realStudents, ...added.filter(s => !known.has(s.id))]
  } catch {
    return [...BASE_STUDENTS, ...realStudents]
  }
}
