import { DEMO_DATA } from '@/lib/demo'

// Shared attendance session data — used by the Attendance page itself and by
// the dashboard home's "Recent Attendance" widget, so both show the same
// real numbers instead of the home page having its own frozen copy.

export type Status = 'present' | 'late' | 'absent'

export interface SessionRecord {
  id: string
  date: string
  team_id: string
  team_name: string
  coach: string
  records: Record<string, Status>
  student_names: Record<string, string>
  saved_at: string
}

// ── Dummy history (pre-seeded sessions, until Attendance has its own
// Supabase-backed migration) ────────────────────────────────────────────────
const DEMO_SESSIONS: SessionRecord[] = [
  {
    id: 'ds-1', date: '2026-06-30', team_id: 'mfa-u17', team_name: 'MFA U-17', coach: 'Coach Nader',
    records: { '1': 'present', '2': 'present', '3': 'absent', '4': 'late' },
    student_names: { '1': 'Karim Nassar', '2': 'Omar Khalil', '3': 'Ahmad Hamdan', '4': 'Rami Fares' },
    saved_at: '2026-06-30T18:00:00',
  },
  {
    id: 'ds-2', date: '2026-06-29', team_id: 'mfa-u14', team_name: 'MFA U-14', coach: 'Coach Bilal',
    records: { '5': 'present', '6': 'present', '7': 'absent', '8': 'present' },
    student_names: { '5': 'Youssef Aoun', '6': 'Ali Hassan', '7': 'Tarek Moussa', '8': 'Bilal Khoury' },
    saved_at: '2026-06-29T17:30:00',
  },
  {
    id: 'ds-3', date: '2026-06-28', team_id: 'mba-u16', team_name: 'MBA U-16', coach: 'Coach Samer',
    records: { '9': 'present', '10': 'late', '11': 'absent', '12': 'present' },
    student_names: { '9': 'Nour Saleh', '10': 'Lara Haddad', '11': 'Sara Mansour', '12': 'Maya Rizk' },
    saved_at: '2026-06-28T18:00:00',
  },
  {
    id: 'ds-4', date: '2026-06-26', team_id: 'mfa-u17', team_name: 'MFA U-17', coach: 'Coach Nader',
    records: { '1': 'present', '2': 'late', '3': 'present', '4': 'present' },
    student_names: { '1': 'Karim Nassar', '2': 'Omar Khalil', '3': 'Ahmad Hamdan', '4': 'Rami Fares' },
    saved_at: '2026-06-26T18:00:00',
  },
  {
    id: 'ds-5', date: '2026-06-25', team_id: 'mfa-u14', team_name: 'MFA U-14', coach: 'Coach Bilal',
    records: { '5': 'present', '6': 'present', '7': 'late', '8': 'present' },
    student_names: { '5': 'Youssef Aoun', '6': 'Ali Hassan', '7': 'Tarek Moussa', '8': 'Bilal Khoury' },
    saved_at: '2026-06-25T17:30:00',
  },
  {
    id: 'ds-6', date: '2026-06-24', team_id: 'mba-u16', team_name: 'MBA U-16', coach: 'Coach Samer',
    records: { '9': 'present', '10': 'present', '11': 'absent', '12': 'late' },
    student_names: { '9': 'Nour Saleh', '10': 'Lara Haddad', '11': 'Sara Mansour', '12': 'Maya Rizk' },
    saved_at: '2026-06-24T18:00:00',
  },
  {
    id: 'ds-7', date: '2026-06-22', team_id: 'mfa-u17', team_name: 'MFA U-17', coach: 'Coach Nader',
    records: { '1': 'present', '2': 'present', '3': 'absent', '4': 'present' },
    student_names: { '1': 'Karim Nassar', '2': 'Omar Khalil', '3': 'Ahmad Hamdan', '4': 'Rami Fares' },
    saved_at: '2026-06-22T18:00:00',
  },
  {
    id: 'ds-8', date: '2026-06-21', team_id: 'mfa-u14', team_name: 'MFA U-14', coach: 'Coach Bilal',
    records: { '5': 'present', '6': 'late', '7': 'absent', '8': 'present' },
    student_names: { '5': 'Youssef Aoun', '6': 'Ali Hassan', '7': 'Tarek Moussa', '8': 'Bilal Khoury' },
    saved_at: '2026-06-21T17:30:00',
  },
  {
    id: 'ds-9', date: '2026-06-20', team_id: 'mba-u16', team_name: 'MBA U-16', coach: 'Coach Samer',
    records: { '9': 'late', '10': 'present', '11': 'present', '12': 'present' },
    student_names: { '9': 'Nour Saleh', '10': 'Lara Haddad', '11': 'Sara Mansour', '12': 'Maya Rizk' },
    saved_at: '2026-06-20T18:00:00',
  },
  {
    id: 'ds-10', date: '2026-06-19', team_id: 'mfa-u17', team_name: 'MFA U-17', coach: 'Coach Nader',
    records: { '1': 'present', '2': 'present', '3': 'present', '4': 'absent' },
    student_names: { '1': 'Karim Nassar', '2': 'Omar Khalil', '3': 'Ahmad Hamdan', '4': 'Rami Fares' },
    saved_at: '2026-06-19T18:00:00',
  },
]

export const DUMMY_SESSIONS: SessionRecord[] = DEMO_DATA ? DEMO_SESSIONS : []

export function loadAllSessions(): SessionRecord[] {
  if (typeof window === 'undefined') return DUMMY_SESSIONS
  try {
    const saved = JSON.parse(localStorage.getItem('mila_attendance_sessions') ?? '[]') as SessionRecord[]
    const ids = new Set(saved.map(s => s.id))
    return [...saved, ...DUMMY_SESSIONS.filter(d => !ids.has(d.id))].sort((a, b) => b.date.localeCompare(a.date))
  } catch {
    return DUMMY_SESSIONS
  }
}
