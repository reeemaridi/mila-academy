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

export const TEAMS: Team[] = [
  { id: 'mfa-u17', name: 'MFA U-17', academy: 'MFA' },
  { id: 'mfa-u14', name: 'MFA U-14', academy: 'MFA' },
  { id: 'mba-u16', name: 'MBA U-16', academy: 'MBA' },
]

export function teamName(id: string) {
  return TEAMS.find((t) => t.id === id)?.name ?? id
}

// ── Base students ──────────────────────────────────────────────────────────────

export const BASE_STUDENTS: StudentRow[] = [
  // ── MFA U-17 ─────────────────────────────────────────────────────────────
  {
    id: '1', name: 'Karim Nassar', dob: '2008-03-15', nationality: 'Lebanese',
    position: 'Forward', jersey_number: 10, team_id: 'mfa-u17', academy: 'MFA',
    blood_type: 'A+', allergies: 'None', injuries: 'Right knee sprain (2025)',
    doctor_contact: 'Dr. Hassan Khalil · +961 70 111 000',
    parent_name: 'Hassan Nassar', parent_phone: '+961 70 222 333', parent_whatsapp: '96170222333',
    emergency_contact: 'Layla Nassar · +961 70 444 555',
    payment_status: 'paid', payment_amount: 150, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-09-01', attendance_rate: 92, overall_rating: 4.9,
    awards: ['⚽ Top Scorer', '🌟 Player of the Month — May'],
  },
  {
    id: '2', name: 'Omar Khalil', dob: '2009-06-22', nationality: 'Lebanese',
    position: 'Midfielder', jersey_number: 8, team_id: 'mfa-u17', academy: 'MFA',
    blood_type: 'O+', allergies: 'Penicillin', injuries: 'None',
    doctor_contact: 'Dr. Rami Saad · +961 71 222 000',
    parent_name: 'Khalil Omar', parent_phone: '+961 76 333 444', parent_whatsapp: '96176333444',
    emergency_contact: '',
    payment_status: 'paid', payment_amount: 150, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-09-01', attendance_rate: 88, overall_rating: 4.5,
    awards: ['🎖️ Best Midfielder'],
  },
  {
    id: '3', name: 'Ahmad Hamdan', dob: '2008-11-09', nationality: 'Lebanese',
    position: 'Defender', jersey_number: 4, team_id: 'mfa-u17', academy: 'MFA',
    blood_type: 'B+', allergies: 'None', injuries: 'None',
    doctor_contact: 'Dr. Nadia Frem · +961 70 555 000',
    parent_name: 'Nabil Hamdan', parent_phone: '+961 70 666 777', parent_whatsapp: '96170666777',
    emergency_contact: 'Rita Hamdan · +961 70 888 999',
    payment_status: 'partial', payment_amount: 75, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-10-01', attendance_rate: 75, overall_rating: 3.8,
    awards: [],
  },
  {
    id: '4', name: 'Rami Fares', dob: '2008-07-30', nationality: 'Lebanese',
    position: 'Goalkeeper', jersey_number: 1, team_id: 'mfa-u17', academy: 'MFA',
    blood_type: 'AB+', allergies: 'None', injuries: 'Shoulder strain (2024)',
    doctor_contact: 'Dr. Hassan Khalil · +961 70 111 000',
    parent_name: 'George Fares', parent_phone: '+961 71 888 999', parent_whatsapp: '96171888999',
    emergency_contact: '',
    payment_status: 'unpaid', payment_amount: 0, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-09-01', attendance_rate: 82, overall_rating: 4.2,
    awards: ['🧤 Best Goalkeeper'],
  },
  // ── MFA U-14 ─────────────────────────────────────────────────────────────
  {
    id: '5', name: 'Youssef Aoun', dob: '2011-02-14', nationality: 'Lebanese',
    position: 'Forward', jersey_number: 9, team_id: 'mfa-u14', academy: 'MFA',
    blood_type: 'A-', allergies: 'None', injuries: 'None',
    doctor_contact: 'Dr. Sami Khoury · +961 70 100 200',
    parent_name: 'Elie Aoun', parent_phone: '+961 70 300 400', parent_whatsapp: '96170300400',
    emergency_contact: 'Mary Aoun · +961 70 500 600',
    payment_status: 'paid', payment_amount: 150, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-09-01', attendance_rate: 95, overall_rating: 4.7,
    awards: ['⚽ Top Scorer U-14', '🏅 Most Improved Player'],
  },
  {
    id: '6', name: 'Ali Hassan', dob: '2011-08-05', nationality: 'Lebanese',
    position: 'Midfielder', jersey_number: 7, team_id: 'mfa-u14', academy: 'MFA',
    blood_type: 'O-', allergies: 'Dust allergy', injuries: 'None',
    doctor_contact: 'Dr. Sami Khoury · +961 70 100 200',
    parent_name: 'Hassan Ali', parent_phone: '+961 78 500 600', parent_whatsapp: '96178500600',
    emergency_contact: '',
    payment_status: 'paid', payment_amount: 150, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-09-15', attendance_rate: 91, overall_rating: 4.4,
    awards: ['🎯 Best Accuracy'],
  },
  {
    id: '7', name: 'Tarek Moussa', dob: '2012-01-20', nationality: 'Lebanese',
    position: 'Defender', jersey_number: 5, team_id: 'mfa-u14', academy: 'MFA',
    blood_type: 'B-', allergies: 'None', injuries: 'Ankle sprain (2025)',
    doctor_contact: 'Dr. Nadia Frem · +961 70 555 000',
    parent_name: 'Moussa Tarek', parent_phone: '+961 70 700 800', parent_whatsapp: '96170700800',
    emergency_contact: '',
    payment_status: 'unpaid', payment_amount: 0, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-10-15', attendance_rate: 68, overall_rating: 3.5,
    awards: [],
  },
  {
    id: '8', name: 'Bilal Khoury', dob: '2011-12-11', nationality: 'Lebanese',
    position: 'Winger', jersey_number: 11, team_id: 'mfa-u14', academy: 'MFA',
    blood_type: 'A+', allergies: 'None', injuries: 'None',
    doctor_contact: 'Dr. Rami Saad · +961 71 222 000',
    parent_name: 'Khoury Bilal', parent_phone: '+961 76 900 100', parent_whatsapp: '96176900100',
    emergency_contact: 'Mira Khoury · +961 76 200 300',
    payment_status: 'paid', payment_amount: 150, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-09-01', attendance_rate: 87, overall_rating: 4.1,
    awards: [],
  },
  // ── MBA U-16 ─────────────────────────────────────────────────────────────
  {
    id: '9', name: 'Nour Saleh', dob: '2009-04-18', nationality: 'Lebanese',
    position: 'Point Guard', jersey_number: 3, team_id: 'mba-u16', academy: 'MBA',
    blood_type: 'O+', allergies: 'None', injuries: 'None',
    doctor_contact: 'Dr. Leila Nassar · +961 70 200 300',
    parent_name: 'Saleh Nour', parent_phone: '+961 71 400 500', parent_whatsapp: '96171400500',
    emergency_contact: '',
    payment_status: 'paid', payment_amount: 150, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-09-01', attendance_rate: 90, overall_rating: 4.6,
    awards: ['🏀 Top Assist Leader', '🌟 Player of the Month — June'],
  },
  {
    id: '10', name: 'Lara Haddad', dob: '2010-09-25', nationality: 'Lebanese',
    position: 'Small Forward', jersey_number: 6, team_id: 'mba-u16', academy: 'MBA',
    blood_type: 'A+', allergies: 'Pollen allergy', injuries: 'None',
    doctor_contact: 'Dr. Leila Nassar · +961 70 200 300',
    parent_name: 'George Haddad', parent_phone: '+961 70 600 700', parent_whatsapp: '96170600700',
    emergency_contact: 'May Haddad · +961 70 800 900',
    payment_status: 'partial', payment_amount: 75, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-09-15', attendance_rate: 77, overall_rating: 4.0,
    awards: [],
  },
  {
    id: '11', name: 'Sara Mansour', dob: '2010-06-08', nationality: 'Lebanese',
    position: 'Center', jersey_number: 12, team_id: 'mba-u16', academy: 'MBA',
    blood_type: 'B+', allergies: 'None', injuries: 'Left knee contusion (2025)',
    doctor_contact: 'Dr. Sami Khoury · +961 70 100 200',
    parent_name: 'Nadim Mansour', parent_phone: '+961 76 800 900', parent_whatsapp: '96176800900',
    emergency_contact: '',
    payment_status: 'unpaid', payment_amount: 0, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-10-01', attendance_rate: 63, overall_rating: 3.7,
    awards: [],
  },
  {
    id: '12', name: 'Maya Rizk', dob: '2009-12-03', nationality: 'Lebanese',
    position: 'Shooting Guard', jersey_number: 15, team_id: 'mba-u16', academy: 'MBA',
    blood_type: 'AB-', allergies: 'None', injuries: 'None',
    doctor_contact: 'Dr. Leila Nassar · +961 70 200 300',
    parent_name: 'Antoine Rizk', parent_phone: '+961 70 100 200', parent_whatsapp: '96170100200',
    emergency_contact: 'Claire Rizk · +961 70 300 400',
    payment_status: 'paid', payment_amount: 150, payment_due_date: '2026-07-01',
    notes: '', created_at: '2024-09-01', attendance_rate: 85, overall_rating: 4.3,
    awards: ['🏀 Best Shooter'],
  },
]

// ── Generators (deterministic, no Math.random) ─────────────────────────────────

const SESSION_DATES = [
  '2026-06-30','2026-06-28','2026-06-25','2026-06-23','2026-06-21',
  '2026-06-18','2026-06-16','2026-06-14','2026-06-11','2026-06-09',
  '2026-06-07','2026-06-04','2026-06-02','2026-05-31','2026-05-29',
  '2026-05-26','2026-05-24','2026-05-21','2026-05-19','2026-05-17',
]

export function generateAttendance(id: string, rate: number): AttendanceEntry[] {
  const n = parseInt(id) || 1
  return SESSION_DATES.map((date, i) => {
    const hash = (n * 13 + i * 7) % 100
    let status: AttendanceEntry['status']
    if (hash < rate - 12) status = 'present'
    else if (hash < rate) status = 'late'
    else status = 'absent'
    return { date, status }
  })
}

const COACHES = ['Coach Nader', 'Coach Bilal', 'Coach Samer']
const RATING_NOTES = [
  'Great effort and focus throughout the session.',
  'Needs to work on endurance in the second half.',
  'Excellent ball control, impressive footwork.',
  '',
]

export function generateRatings(id: string, overallRating: number): RatingEntry[] {
  const n   = parseInt(id) || 1
  const base = Math.min(10, Math.round(overallRating * 2)) // convert 1-5 → 1-10
  const clamp = (v: number) => Math.min(10, Math.max(1, v))

  return [
    {
      id: `r1-${id}`, date: '2026-06-28', coach: COACHES[n % 3],
      technique: clamp(base + (n % 3 === 0 ? 1 : 0)),
      fitness:   clamp(base),
      attitude:  clamp(base + 1),
      teamwork:  clamp(base),
      overall:   parseFloat((base * 0.95 + 0.3).toFixed(1)),
      notes: RATING_NOTES[n % 4],
    },
    {
      id: `r2-${id}`, date: '2026-06-14', coach: COACHES[(n + 1) % 3],
      technique: clamp(base - 1),
      fitness:   clamp(base + 1),
      attitude:  clamp(base),
      teamwork:  clamp(base + 1),
      overall:   parseFloat((base * 0.88 + 0.2).toFixed(1)),
      notes: RATING_NOTES[(n + 1) % 4],
    },
    {
      id: `r3-${id}`, date: '2026-05-31', coach: COACHES[(n + 2) % 3],
      technique: clamp(base),
      fitness:   clamp(base - 1),
      attitude:  clamp(base),
      teamwork:  clamp(base - 1),
      overall:   parseFloat((base * 0.85).toFixed(1)),
      notes: RATING_NOTES[(n + 2) % 4],
    },
  ]
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

const MONTHS_2026 = PAYMENT_MONTHS
const METHODS: Array<PaymentEntry['method']> = ['cash', 'bank', 'whatsapp', 'cash', 'bank', 'cash']

export function generatePayments(id: string, currentStatus: StudentRow['payment_status']): PaymentEntry[] {
  const n = parseInt(id) || 1
  return MONTHS_2026.map((month, i) => {
    const isCurrent = i === MONTHS_2026.length - 1
    const status: PaymentEntry['status'] = isCurrent ? currentStatus : 'paid'
    const paid_date = status === 'paid'
      ? `2026-${String(i + 1).padStart(2, '0')}-${String((n % 5) + 1).padStart(2, '0')}`
      : status === 'partial' ? `2026-${String(i + 1).padStart(2, '0')}-15` : ''
    return {
      id: `pay-${id}-${i}`,
      month,
      amount: 150,
      status,
      paid_date,
      method: status !== 'unpaid' ? METHODS[(n + i) % METHODS.length] : '',
    }
  })
}

// ── Merge helpers ──────────────────────────────────────────────────────────────

export function loadAllStudents(): StudentRow[] {
  if (typeof window === 'undefined') return BASE_STUDENTS
  try {
    const added = JSON.parse(localStorage.getItem('mila_students_added') ?? '[]') as StudentRow[]
    return [...BASE_STUDENTS, ...added]
  } catch {
    return BASE_STUDENTS
  }
}
