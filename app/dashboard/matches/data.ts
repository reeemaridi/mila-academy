// Shared match data — used by the Matches page itself and by the dashboard
// home's "Upcoming Matches" widget, so both show the same real numbers
// instead of the home page having its own frozen copy.

export interface Scorer { id: string; name: string; minute: number }

export interface MatchRecord {
  id: string
  team_id: string
  team_name: string
  opponent: string
  date: string
  time: string
  location: string
  home_away: 'home' | 'away'
  status: 'upcoming' | 'live' | 'completed'
  score_us: number
  score_them: number
  lineup: string[]
  scorers: Scorer[]
  opp_goal_minutes: number[]
  coach_notes: string
  live_started_at: string
  created_at: string
}

// ── Dummy data (until Matches has its own Supabase-backed migration) ────────
export const DUMMY_MATCHES: MatchRecord[] = []

export function loadAllMatches(): MatchRecord[] {
  if (typeof window === 'undefined') return DUMMY_MATCHES
  try {
    const stored = JSON.parse(localStorage.getItem('mila_matches') ?? '[]') as MatchRecord[]
    const storedIds = new Set(stored.map(m => m.id))
    return [...stored, ...DUMMY_MATCHES.filter(m => !storedIds.has(m.id))]
      .sort((a, b) => b.date.localeCompare(a.date))
  } catch {
    return DUMMY_MATCHES
  }
}
