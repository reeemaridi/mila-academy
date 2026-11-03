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
export const DUMMY_SESSIONS: SessionRecord[] = []

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
