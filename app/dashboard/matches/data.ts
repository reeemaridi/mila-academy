import { DEMO_DATA } from '@/lib/demo'

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
const DEMO_MATCHES: MatchRecord[] = [
  // Upcoming
  {
    id: 'dm-1', team_id: 'mfa-u17', team_name: 'MFA U-17', opponent: 'Al-Nejmeh SC',
    date: '2026-07-05', time: '15:00', location: 'Beirut Municipal Stadium',
    home_away: 'home', status: 'upcoming', score_us: 0, score_them: 0,
    lineup: ['1','2','3','4'], scorers: [], opp_goal_minutes: [], coach_notes: '',
    live_started_at: '', created_at: '2026-06-28',
  },
  {
    id: 'dm-2', team_id: 'mfa-u14', team_name: 'MFA U-14', opponent: 'Safa SC',
    date: '2026-07-08', time: '10:00', location: 'Sports City Beirut',
    home_away: 'away', status: 'upcoming', score_us: 0, score_them: 0,
    lineup: [], scorers: [], opp_goal_minutes: [], coach_notes: '',
    live_started_at: '', created_at: '2026-06-29',
  },
  {
    id: 'dm-3', team_id: 'mba-u16', team_name: 'MBA U-16', opponent: 'Riyadi Club',
    date: '2026-07-12', time: '16:00', location: 'Farouk Palace',
    home_away: 'home', status: 'upcoming', score_us: 0, score_them: 0,
    lineup: [], scorers: [], opp_goal_minutes: [], coach_notes: '',
    live_started_at: '', created_at: '2026-06-30',
  },
  // Completed
  {
    id: 'dm-4', team_id: 'mfa-u17', team_name: 'MFA U-17', opponent: 'Tripoli FC',
    date: '2026-06-25', time: '15:00', location: 'Beirut Municipal Stadium',
    home_away: 'home', status: 'completed', score_us: 3, score_them: 1,
    lineup: ['1','2','3','4'],
    scorers: [{ id:'1', name:'Karim Nassar', minute:18 }, { id:'1', name:'Karim Nassar', minute:55 }, { id:'2', name:'Omar Khalil', minute:78 }],
    opp_goal_minutes: [42], coach_notes: 'Excellent first half pressing. Karim was outstanding.',
    live_started_at: '', created_at: '2026-06-20',
  },
  {
    id: 'dm-5', team_id: 'mfa-u14', team_name: 'MFA U-14', opponent: 'Racing Club',
    date: '2026-06-20', time: '10:00', location: 'Sports City Beirut',
    home_away: 'away', status: 'completed', score_us: 0, score_them: 2,
    lineup: ['5','6','7','8'],
    scorers: [],
    opp_goal_minutes: [23, 67], coach_notes: 'Struggled defensively. Need to work on marking.',
    live_started_at: '', created_at: '2026-06-15',
  },
  {
    id: 'dm-6', team_id: 'mba-u16', team_name: 'MBA U-16', opponent: 'Hoops Academy',
    date: '2026-06-15', time: '16:00', location: 'Farouk Palace',
    home_away: 'home', status: 'completed', score_us: 2, score_them: 2,
    lineup: ['9','10','11','12'],
    scorers: [{ id:'9', name:'Nour Saleh', minute:12 }, { id:'12', name:'Maya Rizk', minute:74 }],
    opp_goal_minutes: [31, 88], coach_notes: 'Good fight-back from 0-2 down. Resilient performance.',
    live_started_at: '', created_at: '2026-06-10',
  },
  {
    id: 'dm-7', team_id: 'mfa-u17', team_name: 'MFA U-17', opponent: 'Ansar FC',
    date: '2026-06-10', time: '15:00', location: 'Camille Chamoun Stadium',
    home_away: 'away', status: 'completed', score_us: 2, score_them: 0,
    lineup: ['1','2','3','4'],
    scorers: [{ id:'1', name:'Karim Nassar', minute:34 }, { id:'2', name:'Omar Khalil', minute:61 }],
    opp_goal_minutes: [], coach_notes: 'Dominant display. Clean sheet deserved.',
    live_started_at: '', created_at: '2026-06-05',
  },
  {
    id: 'dm-8', team_id: 'mfa-u14', team_name: 'MFA U-14', opponent: 'Sagesse SC',
    date: '2026-06-05', time: '10:00', location: 'Sports City Beirut',
    home_away: 'home', status: 'completed', score_us: 1, score_them: 1,
    lineup: ['5','6','7','8'],
    scorers: [{ id:'5', name:'Youssef Aoun', minute:52 }],
    opp_goal_minutes: [79], coach_notes: 'Fair result. Youssef growing in confidence.',
    live_started_at: '', created_at: '2026-06-01',
  },
]

export const DUMMY_MATCHES: MatchRecord[] = DEMO_DATA ? DEMO_MATCHES : []

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
