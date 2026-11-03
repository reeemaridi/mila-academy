'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { type AcademyFilter } from '@/lib/auth'
import { useSession, useSelectedAcademy } from '@/lib/use-session'
import { fetchStudents, fetchTeams, type TeamRow } from './students/api'
import type { StudentRow } from './students/data'
import { loadAllSessions } from './attendance/data'
import { loadAllMatches } from './matches/data'
import {
  IconUsers,
  IconClipboardList,
  IconCash,
  IconAlertCircle,
  IconStarFilled,
  IconStar,
  IconMapPin,
  IconCalendar,
  IconChevronRight,
} from '@tabler/icons-react'

// ── Static meta (icons/colors for stat cards) ───────────────────────────────────

const STAT_CARD_META = [
  { label: 'Total Students',     Icon: IconUsers,         tint: 'rgba(22,163,74,0.12)',  iconColor: '#16a34a', border: 'rgba(22,163,74,0.2)'  },
  { label: 'Total Coaches',      Icon: IconClipboardList, tint: 'rgba(59,130,246,0.12)', iconColor: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
  { label: 'Revenue This Month', Icon: IconCash,          tint: 'rgba(245,197,24,0.1)',  iconColor: '#f5c518', border: 'rgba(245,197,24,0.2)' },
  { label: 'Unpaid Students',    Icon: IconAlertCircle,   tint: 'rgba(239,68,68,0.1)',   iconColor: '#ef4444', border: 'rgba(239,68,68,0.2)' },
]

const ACADEMY_LABEL: Record<AcademyFilter, string> = {
  MFA: 'Mila Football Academy',
  MBA: 'Mila Basket Academy',
  Both: 'Mila Academy',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#f5c518' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, backgroundColor: 'var(--border)', borderRadius: 2 }}>
        <div style={{ width: `${rate}%`, height: '100%', backgroundColor: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600, minWidth: 32 }}>{rate}%</span>
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  const full  = Math.floor(rating)
  const empty = 5 - Math.ceil(rating)
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {Array.from({ length: full  }).map((_, i) => <IconStarFilled key={`f${i}`} size={13} style={{ color: '#f5c518' }} />)}
      {rating % 1 > 0                            && <IconStarFilled key="h" size={13} style={{ color: '#f5c518', opacity: 0.4 }} />}
      {Array.from({ length: empty }).map((_, i) => <IconStar       key={`e${i}`} size={13} style={{ color: 'var(--text-muted)' }} />)}
    </span>
  )
}

const STATUS_STYLE: Record<'paid' | 'unpaid' | 'partial', { bg: string; color: string; label: string }> = {
  paid:    { bg: 'rgba(22,163,74,0.15)',  color: '#16a34a', label: 'Paid'    },
  unpaid:  { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Unpaid'  },
  partial: { bg: 'rgba(245,197,24,0.15)',color: '#f5c518', label: 'Partial' },
}

const ACADEMY_BADGE: Record<'MFA' | 'MBA', { bg: string; color: string }> = {
  MFA: { bg: 'rgba(22,163,74,0.15)',  color: '#16a34a' },
  MBA: { bg: 'rgba(249,115,22,0.15)', color: '#f97316' },
}

// ── Card shell ─────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '0.5px solid var(--border)',
      borderRadius: 12,
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ title, linkLabel, linkHref }: { title: string; linkLabel?: string; linkHref?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: 0 }}>{title}</h2>
      {linkLabel && linkHref && (
        <Link href={linkHref} style={{ color: '#f5c518', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
          {linkLabel} <IconChevronRight size={14} />
        </Link>
      )}
    </div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0', margin: 0 }}>{text}</p>
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DashboardHome() {
  const { user: session } = useSession()
  const name = session?.name ?? 'Coach'
  // Money figures: administrators, and coaches an administrator allowed.
  const isAdmin = session?.role === 'admin' || !!session?.canViewPayments
  const [initials] = useState(() =>
    (name ?? 'C')
      .split(' ')
      .map((w: string) => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2)
  )
  const [greeting] = useState(() => getGreeting(new Date().getHours()))
  const [dateStr]  = useState(() => new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }))

  const selectedAcademy = useSelectedAcademy()

  // Real data: students + teams (Supabase), coach count (Supabase),
  // attendance/matches (still the shared localStorage system — see
  // app/dashboard/attendance/data.ts and matches/data.ts).
  const [students,   setStudents]   = useState<StudentRow[]>([])
  const [teams,       setTeams]      = useState<TeamRow[]>([])
  const [coachCount, setCoachCount] = useState<number | null>(null)
  const [loading,     setLoading]    = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchStudents(),
      fetchTeams(),
      fetch('/api/admin/coaches').then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
    ]).then(([s, t, coachesRes]) => {
      if (cancelled) return
      setStudents(s)
      setTeams(t)
      setCoachCount(Array.isArray(coachesRes.data) ? coachesRes.data.length : null)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const sessions = useMemo(() => loadAllSessions(), [])
  const matches  = useMemo(() => loadAllMatches(), [])

  const academyStudents = useMemo(
    () => selectedAcademy === 'Both' ? students : students.filter(s => s.academy === selectedAcademy),
    [students, selectedAcademy]
  )

  const statValues = useMemo(() => {
    const revenue = academyStudents.filter(s => s.payment_status !== 'unpaid').reduce((sum, s) => sum + s.payment_amount, 0)
    const unpaid  = academyStudents.filter(s => s.payment_status === 'unpaid').length
    return [
      String(academyStudents.length),
      coachCount === null ? '—' : String(coachCount),
      `$${revenue.toLocaleString()}`,
      String(unpaid),
    ]
  }, [academyStudents, coachCount])

  const statCards = useMemo(() =>
    STAT_CARD_META.map((m, i) => ({ ...m, value: statValues[i] }))
      .filter(c => isAdmin || !/Revenue|Unpaid/.test(c.label)),
    [statValues, isAdmin]
  )

  // Team academy lookup for the old localStorage-based team ids ('mfa-u17' etc.)
  // used by Attendance/Matches, distinct from the new Supabase team UUIDs.
  const legacyTeamAcademy = (teamId: string): 'MFA' | 'MBA' | null => {
    if (teamId.startsWith('mfa')) return 'MFA'
    if (teamId.startsWith('mba')) return 'MBA'
    return null
  }

  const recentAttendance = useMemo(() => {
    const filtered = selectedAcademy === 'Both'
      ? sessions
      : sessions.filter(s => legacyTeamAcademy(s.team_id) === selectedAcademy)
    return filtered.slice(0, 5).map(s => {
      const vals = Object.values(s.records)
      const present = vals.filter(v => v === 'present').length
      const absent  = vals.filter(v => v === 'absent').length
      const rate    = vals.length > 0 ? Math.round((vals.filter(v => v !== 'absent').length / vals.length) * 100) : 0
      return { date: s.date, team: s.team_name, present, absent, rate }
    })
  }, [sessions, selectedAcademy])

  const upcomingMatches = useMemo(() => {
    const filtered = matches.filter(m => m.status === 'upcoming' && (
      selectedAcademy === 'Both' || legacyTeamAcademy(m.team_id) === selectedAcademy
    ))
    return filtered
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
      .map(m => ({
        team: m.team_name, opponent: m.opponent, date: m.date, location: m.location,
        academy: legacyTeamAcademy(m.team_id) ?? 'MFA' as const,
      }))
  }, [matches, selectedAcademy])

  const paymentBreakdown = useMemo(() => {
    const total = academyStudents.length || 1
    const paid    = academyStudents.filter(s => s.payment_status === 'paid').length
    const unpaid  = academyStudents.filter(s => s.payment_status === 'unpaid').length
    const partial = academyStudents.filter(s => s.payment_status === 'partial').length
    return {
      paidPct:    Math.round((paid    / total) * 100),
      unpaidPct:  Math.round((unpaid  / total) * 100),
      partialPct: Math.round((partial / total) * 100),
    }
  }, [academyStudents])

  const recentPayments = useMemo(() =>
    [...academyStudents]
      .filter(s => s.payment_due_date)
      .sort((a, b) => (b.payment_due_date ?? '').localeCompare(a.payment_due_date ?? ''))
      .slice(0, 5),
    [academyStudents]
  )

  const topRatedPlayers = useMemo(() =>
    [...academyStudents]
      .filter(s => s.overall_rating > 0)
      .sort((a, b) => b.overall_rating - a.overall_rating)
      .slice(0, 3),
    [academyStudents]
  )

  const teamNameFor = (teamId: string) => teams.find(t => t.id === teamId)?.name ?? '—'

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <style>{`
        .dash-stats  { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .dash-cols   { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 20px; margin-top: 20px; }
        .dash-left   { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
        .dash-right  { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
        .att-table   { width: 100%; border-collapse: collapse; }
        .table-scroll .att-table { min-width: 440px; }
        .att-table th{ color: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: 1px;
                       text-transform: uppercase; padding: 0 0 10px; text-align: left; }
        .att-table td{ padding: 10px 0; border-top: 1px solid var(--border); font-size: 13px; color: var(--text-secondary); vertical-align: middle; }
        .att-table tr:first-child td { border-top: none; }
        @media (max-width: 900px) {
          .dash-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .dash-cols  { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 500px) {
          .dash-stats { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 'clamp(19px, 5.5vw, 24px)', fontWeight: 700, margin: '0 0 4px', lineHeight: 1.2 }}>
            {greeting}, {name}
          </h1>
          <p style={{ color: '#f5c518', fontSize: 13, margin: '0 0 2px', letterSpacing: '0.3px' }}>
            {dateStr}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
            {ACADEMY_LABEL[selectedAcademy]}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            backgroundColor: 'rgba(245,197,24,0.15)',
            border: '1.5px solid rgba(245,197,24,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f5c518', fontWeight: 700, fontSize: 13,
          }}>
            {initials}
          </div>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="dash-stats">
        {statCards.map(({ label, value, Icon, tint, iconColor, border }) => (
          <Card key={label} style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
            {/* Tinted background blob */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundColor: tint,
              borderRadius: 12,
              pointerEvents: 'none',
            }} />
            {/* Icon — top right */}
            <div style={{
              position: 'absolute', top: 16, right: 16,
              width: 38, height: 38, borderRadius: 10,
              backgroundColor: `${iconColor}1a`,
              border: `1px solid ${border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: iconColor,
            }}>
              <Icon size={20} stroke={1.8} />
            </div>
            {/* Value */}
            <p style={{ color: 'var(--text-primary)', fontSize: 32, fontWeight: 700, margin: '0 0 4px', lineHeight: 1, position: 'relative' }}>
              {loading ? '—' : value}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, position: 'relative' }}>
              {label}
            </p>
          </Card>
        ))}
      </div>

      {/* ── Main two-column content ──────────────────────────────────────────── */}
      <div className="dash-cols">

        {/* ── LEFT ────────────────────────────────────────────────────────── */}
        <div className="dash-left">

          {/* Recent Attendance */}
          <Card style={{ padding: '20px 24px' }}>
            <SectionTitle title="Recent Attendance" linkLabel="View all" linkHref="/dashboard/attendance" />
            {recentAttendance.length === 0 ? (
              <EmptyNote text="No attendance sessions recorded yet." />
            ) : (
              <div className="table-scroll">
              <table className="att-table">
                <thead>
                  <tr>
                    <th style={{ width: 72 }}>Date</th>
                    <th>Team</th>
                    <th style={{ textAlign: 'center' }}>Present</th>
                    <th style={{ textAlign: 'center' }}>Absent</th>
                    <th style={{ width: 120 }}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttendance.map((row) => (
                    <tr key={row.date + row.team}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.date}</td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: row.team.startsWith('MFA') ? 'rgba(22,163,74,0.13)' : 'rgba(249,115,22,0.13)',
                          color:           row.team.startsWith('MFA') ? '#16a34a'               : '#f97316',
                        }}>
                          {row.team}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{row.present}</td>
                      <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{row.absent}</td>
                      <td><RateBar rate={row.rate} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </Card>

          {/* Upcoming Matches */}
          <Card style={{ padding: '20px 24px' }}>
            <SectionTitle title="Upcoming Matches" linkLabel="View all" linkHref="/dashboard/matches" />
            {upcomingMatches.length === 0 ? (
              <EmptyNote text="No upcoming matches scheduled." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {upcomingMatches.map((m) => {
                  const badge = ACADEMY_BADGE[m.academy]
                  return (
                    <div key={m.team + m.opponent + m.date} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      backgroundColor: 'var(--bg-hover)', border: '0.5px solid var(--border)',
                      borderRadius: 10, padding: '12px 16px',
                    }}>
                      {/* Academy badge */}
                      <span style={{
                        flexShrink: 0,
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        letterSpacing: '0.5px',
                      }}>
                        {m.academy}
                      </span>
                      {/* Teams */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: '0 0 3px' }}>
                          {m.team} <span style={{ color: 'var(--text-muted)' }}>vs</span> {m.opponent}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <IconCalendar size={12} stroke={1.8} style={{ flexShrink: 0 }} /> {m.date}
                          <span>·</span>
                          <IconMapPin size={12} stroke={1.8} style={{ flexShrink: 0 }} /> {m.location}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT ───────────────────────────────────────────────────────── */}
        <div className="dash-right">

          {/* Payment Overview */}
          {isAdmin && (
          <Card style={{ padding: '20px 24px' }}>
            <SectionTitle title="Payment Overview" />

            {academyStudents.length === 0 ? (
              <EmptyNote text="No students yet." />
            ) : (
              <>
                {/* Donut */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, marginBottom: 20 }}>
                  {/* CSS conic-gradient donut */}
                  <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
                    <div style={{
                      width: 110, height: 110, borderRadius: '50%',
                      background: `conic-gradient(#16a34a 0% ${paymentBreakdown.paidPct}%, #ef4444 ${paymentBreakdown.paidPct}% ${paymentBreakdown.paidPct + paymentBreakdown.unpaidPct}%, #f5c518 ${paymentBreakdown.paidPct + paymentBreakdown.unpaidPct}% 100%)`,
                    }} />
                    {/* Inner cutout */}
                    <div style={{
                      position: 'absolute', inset: '18px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-card)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{paymentBreakdown.paidPct}%</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>paid</span>
                    </div>
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Paid',    pct: `${paymentBreakdown.paidPct}%`,    color: '#16a34a' },
                      { label: 'Unpaid',  pct: `${paymentBreakdown.unpaidPct}%`,  color: '#ef4444' },
                      { label: 'Partial', pct: `${paymentBreakdown.partialPct}%`, color: '#f5c518' },
                    ].map(({ label, pct, color }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{label}</span>
                        <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, marginLeft: 'auto', paddingLeft: 12 }}>{pct}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent payments list */}
                {recentPayments.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }}>
                      Recent Payments
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {recentPayments.map((p) => {
                        const s = STATUS_STYLE[p.payment_status]
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* Initials dot */}
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                              backgroundColor: 'var(--bg-hover)', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700,
                            }}>
                              {p.name.split(' ').map(w => w[0]).join('')}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.name}
                              </p>
                              <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>{teamNameFor(p.team_id)}</p>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>${p.payment_amount}</p>
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 7px', borderRadius: 20,
                                fontSize: 10, fontWeight: 700,
                                backgroundColor: s.bg, color: s.color,
                              }}>
                                {s.label}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
          )}

          {/* Top Rated Players */}
          <Card style={{ padding: '20px 24px' }}>
            <SectionTitle title="Top Rated Players" />
            {topRatedPlayers.length === 0 ? (
              <EmptyNote text="No ratings recorded yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {topRatedPlayers.map((p, i) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Rank */}
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: i === 0 ? 'rgba(245,197,24,0.2)' : i === 1 ? 'rgba(180,180,180,0.1)' : 'rgba(180,100,40,0.1)',
                      color:           i === 0 ? '#f5c518'               : i === 1 ? 'var(--text-secondary)'  : '#cd7f32',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800,
                    }}>
                      {i + 1}
                    </span>
                    {/* Name + team */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>{p.name}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>{teamNameFor(p.team_id)}</p>
                    </div>
                    {/* Rating */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <Stars rating={p.overall_rating} />
                      <p style={{ color: '#f5c518', fontSize: 12, fontWeight: 700, margin: '2px 0 0', textAlign: 'center' }}>
                        {p.overall_rating.toFixed(1)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      </div>
    </div>
  )
}
