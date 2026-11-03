'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  IconCheck, IconClock, IconX, IconChevronDown, IconChevronUp,
  IconFilter, IconTrophy, IconAlertCircle, IconActivity, IconCalendarStats,
  IconUsers,
} from '@tabler/icons-react'
import { TEAMS, loadAllStudents, teamName, type StudentRow } from '../students/data'
import { useRoster } from '../hooks/useRoster'
import { hasAccess } from '@/lib/auth'
import { useSession, useSelectedAcademy, useHydrated } from '@/lib/use-session'
import { useRequireAccess } from '../hooks/useRequireAccess'
import { DUMMY_SESSIONS, type Status, type SessionRecord } from './data'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<Status, { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number }> }> = {
  present: { label: 'Present', color: '#16a34a', bg: 'rgba(22,163,74,0.15)',  Icon: IconCheck },
  late:    { label: 'Late',    color: '#f5c518', bg: 'rgba(245,197,24,0.15)', Icon: IconClock },
  absent:  { label: 'Absent',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  Icon: IconX     },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sessionRate(records: Record<string, Status>) {
  const vals = Object.values(records)
  const attended = vals.filter(v => v !== 'absent').length
  return vals.length > 0 ? Math.round((attended / vals.length) * 100) : 0
}

function sessionCounts(records: Record<string, Status>) {
  const vals = Object.values(records)
  return {
    present: vals.filter(v => v === 'present').length,
    late:    vals.filter(v => v === 'late').length,
    absent:  vals.filter(v => v === 'absent').length,
    total:   vals.length,
  }
}

function isoToday() {
  return new Date().toISOString().split('T')[0]
}

function initials(name: string) {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ message, kind = 'success', onDone }: { message: string; kind?: 'success' | 'error' | 'info'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, kind === 'error' ? 5000 : 3500)
    return () => clearTimeout(t)
  }, [onDone, kind])
  const color = kind === 'error' ? '#ef4444' : kind === 'info' ? '#3b82f6' : '#16a34a'
  const Icon  = kind === 'error' ? IconAlertCircle : IconCheck
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 90, zIndex: 1000,
      backgroundColor: color, color: '#fff',
      padding: '13px 20px', borderRadius: 12,
      fontSize: 14, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: `0 8px 32px ${color}66`,
      animation: 'toastIn 0.3s ease',
      maxWidth: 380,
    }}>
      <Icon size={18} />
      {message}
    </div>
  )
}

// ── Card shell ─────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, ...style }}>
      {children}
    </div>
  )
}

// ── Status pill button ─────────────────────────────────────────────────────────

function StatusPill({
  status,
  active,
  onClick,
}: {
  status: Status
  active: boolean
  onClick: () => void
}) {
  const cfg = STATUS[status]
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 14px', borderRadius: 20,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.15s ease',
        border: `2px solid ${cfg.color}`,
        backgroundColor: active ? cfg.color : 'transparent',
        color: active ? '#fff' : cfg.color,
      }}
    >
      <cfg.Icon size={13} />
      {cfg.label}
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { user: guardedUser, loading: guardLoading } = useRequireAccess('attendance')
  const canTakeAttendance = !!guardedUser && hasAccess('attendance', 'edit', guardedUser)

  const { user: session } = useSession()
  const hydrated = useHydrated()

  // ── Take attendance state ────────────────────────────────────────────────
  const selectedAcademy = useSelectedAcademy()

  // Seeded empty and defaulted after hydration: reading the session in the
  // initialiser gave '' on the prerendered server markup and the coach's team on
  // the client. Same for the date - isoToday() at render time would have baked
  // the *build* date into the static HTML.
  const [teamIdOverride, setTeamId] = useState<string | null>(null)
  const defaultTeamId = (hydrated && session?.role === 'coach' && session.teamId) ? session.teamId : ''
  const teamId = teamIdOverride ?? defaultTeamId

  const [dateOverride, setDate] = useState<string | null>(null)
  const date = dateOverride ?? (hydrated ? isoToday() : '')
  const [statusMap,   setStatusMap]   = useState<Record<string, Status>>({})
  const [toast,       setToast]       = useState('')
  const [toastKind,   setToastKind]   = useState<'success' | 'error' | 'info'>('success')
  const coachName = session?.name ?? 'Coach'
  // Recomputed per render rather than frozen in a useState initialiser, which
  // ran before the session was known and so never applied the coach/parent
  // narrowing on the prerendered markup.
  const rosterVersion = useRoster()
  const allStudents = useMemo<StudentRow[]>(() => {
    const all = loadAllStudents()
    if (!session) return all
    // A coach's list is already limited to their teams by the server.
    if (session.role === 'parent' || session.role === 'student') {
      return all.filter(s => String(s.id) === String(session.studentId))
    }
    return all
  // rosterVersion changes when the real teams/students arrive.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, rosterVersion])

  // Switching academy clears the in-progress sheet, which belongs to the team
  // that is about to stop being visible. Adjusted during render (React's
  // documented alternative to a reset effect) so the stale sheet never paints.
  const [lastAcademy, setLastAcademy] = useState(selectedAcademy)
  if (lastAcademy !== selectedAcademy) {
    setLastAcademy(selectedAcademy)
    setTeamId(null)
    setStatusMap({})
  }

  // ── History state ────────────────────────────────────────────────────────
  const [savedSessions, setSavedSessions] = useState<SessionRecord[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mila_attendance_sessions') ?? '[]') as SessionRecord[]
    } catch {
      return []
    }
  })
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [histTeam,      setHistTeam]      = useState('All')
  const [histFrom,      setHistFrom]      = useState('')
  const [histTo,        setHistTo]        = useState('')

  // ── Derived data ─────────────────────────────────────────────────────────
  const visibleTeams = useMemo(
    () => selectedAcademy === 'Both' ? [...TEAMS] : TEAMS.filter(t => t.academy === selectedAcademy),
    // rosterVersion changes when the real teams arrive (TEAMS is updated in place).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedAcademy, rosterVersion]
  )

  const teamStudents = useMemo(
    () => allStudents.filter(s => s.team_id === teamId),
    [allStudents, teamId]
  )

  const allSessions = useMemo<SessionRecord[]>(() => {
    const ids = new Set(savedSessions.map(s => s.id))
    return [...savedSessions, ...DUMMY_SESSIONS.filter(d => !ids.has(d.id))]
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [savedSessions])

  function notify(message: string, kind: 'success' | 'error' | 'info' = 'success') {
    setToastKind(kind)
    setToast(message)
  }

  // Loads the already-recorded session for this team+date if one exists, instead
  // of silently defaulting to all-present and discarding what a coach already entered.
  function loadOrInitStatusMap(id: string, forDate: string) {
    if (!id) { setStatusMap({}); return }
    const existing = allSessions.find(s => s.team_id === id && s.date === forDate)
    if (existing) {
      setStatusMap({ ...existing.records })
      notify(`Loaded existing session for ${teamName(id)} — ${forDate} (recorded by ${existing.coach})`, 'info')
      return
    }
    const init: Record<string, Status> = {}
    allStudents.filter(s => s.team_id === id).forEach(s => { init[s.id] = 'present' })
    setStatusMap(init)
  }

  function selectTeam(id: string) {
    setTeamId(id)
    loadOrInitStatusMap(id, date)
  }

  function changeDate(newDate: string) {
    setDate(newDate)
    if (teamId) loadOrInitStatusMap(teamId, newDate)
  }

  // ── Stats (last 30 days) ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    const recent = allSessions.filter(s => s.date >= cutoffStr)

    // This week
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const mondayStr = monday.toISOString().split('T')[0]
    const thisWeekSessions = allSessions.filter(s => s.date >= mondayStr)
    let weekTotal = 0, weekAttended = 0
    thisWeekSessions.forEach(s => {
      Object.values(s.records).forEach(r => {
        weekTotal++
        if (r !== 'absent') weekAttended++
      })
    })
    const weekRate = weekTotal > 0 ? Math.round((weekAttended / weekTotal) * 100) : 0

    // Most absent student
    const absences: Record<string, { name: string; count: number }> = {}
    recent.forEach(s => {
      Object.entries(s.records).forEach(([sid, status]) => {
        if (status === 'absent') {
          const n = s.student_names[sid] ?? `Student ${sid}`
          absences[sid] = { name: n, count: (absences[sid]?.count ?? 0) + 1 }
        }
      })
    })
    const mostAbsent = Object.values(absences).sort((a, b) => b.count - a.count)[0] ?? null

    // Best team
    const teamStats: Record<string, { total: number; attended: number }> = {}
    recent.forEach(s => {
      const t = teamStats[s.team_name] ?? { total: 0, attended: 0 }
      Object.values(s.records).forEach(r => {
        t.total++
        if (r !== 'absent') t.attended++
      })
      teamStats[s.team_name] = t
    })
    const bestTeam = Object.entries(teamStats)
      .map(([name, v]) => ({ name, rate: Math.round((v.attended / v.total) * 100) }))
      .sort((a, b) => b.rate - a.rate)[0] ?? null

    return {
      weekRate,
      mostAbsent,
      bestTeam,
      totalSessions: recent.length,
    }
  }, [allSessions])

  // ── Filtered history ─────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => allSessions.filter(s => {
    if (selectedAcademy !== 'Both') {
      const teamAcademy = TEAMS.find(t => t.id === s.team_id)?.academy
      if (teamAcademy && teamAcademy !== selectedAcademy) return false
    }
    if (histTeam !== 'All' && s.team_id !== histTeam) return false
    if (histFrom && s.date < histFrom) return false
    if (histTo   && s.date > histTo)   return false
    return true
  }), [allSessions, selectedAcademy, histTeam, histFrom, histTo])

  // ── Save attendance ───────────────────────────────────────────────────────
  function saveAttendance() {
    if (!teamId || !date) return
    const newSession: SessionRecord = {
      id: `sess-${date}-${teamId}`,
      date,
      team_id:      teamId,
      team_name:    teamName(teamId),
      coach:        coachName,
      records:      { ...statusMap },
      student_names: Object.fromEntries(teamStudents.map(s => [s.id, s.name])),
      saved_at:     new Date().toISOString(),
    }
    const next = [newSession, ...savedSessions.filter(s => !(s.date === date && s.team_id === teamId))]
    try {
      localStorage.setItem('mila_attendance_sessions', JSON.stringify(next))
      setSavedSessions(next)
      notify(`Attendance saved for ${teamName(teamId)} — ${date}`, 'success')
    } catch {
      notify('Failed to save — your browser storage may be full or unavailable. Try again.', 'error')
    }
  }

  const hideDismiss = useCallback(() => setToast(''), [])

  // ── Filter select style ───────────────────────────────────────────────────
  const sel: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8,
    color: 'var(--text-secondary)', fontSize: 13, padding: '9px 32px 9px 12px', outline: 'none',
    appearance: 'none', cursor: 'pointer',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 010 1.659l-4.796 5.48a1 1 0 01-1.506 0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '11px',
  }

  const dateInput: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8,
    color: 'var(--text-secondary)', fontSize: 13, padding: '9px 12px', outline: 'none',
    colorScheme: 'dark',
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (guardLoading) return null

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        @keyframes toastIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .hist-row { cursor: pointer; transition: background 0.15s ease; }
        .hist-row:hover td { background: rgba(255,255,255,0.025) !important; }
        .stat-card-grid { display: grid; grid-template-columns: repeat(4,minmax(0, 1fr)); gap: 14px; }
        @media (max-width: 800px) { .stat-card-grid { grid-template-columns: repeat(2,minmax(0, 1fr)); } }
        @media (max-width: 380px) { .stat-card-grid { grid-template-columns: minmax(0, 1fr); } }

        /* Roll-call row: the three status pills need ~245px on their own, so
           below 560px the name moves above them instead of beside them. */
        .roll-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .roll-pills { display: flex; gap: 8px; flex-shrink: 0; }
        @media (max-width: 560px) {
          .roll-row   { flex-direction: column; align-items: stretch; gap: 10px; }
          .roll-pills { gap: 6px; }
          .roll-pills > button { flex: 1; justify-content: center; }
          /* The "Status" label pointed at a column that no longer exists. */
          .roll-head > span:last-child { display: none; }
        }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Attendance</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Track and review session attendance across all teams.</p>
      </div>

      {/* ══ TAKE ATTENDANCE ════════════════════════════════════════════════
          Only admin/coach can record attendance — parents/students get
          view-only access to the history below (matches hasAccess()). */}
      {canTakeAttendance && (
      <Card style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 700, margin: '0 0 20px' }}>
          Take Attendance
        </h2>

        {/* Controls row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <select value={teamId} onChange={e => selectTeam(e.target.value)} style={{ ...sel, minWidth: 160, flex: '1 1 160px' }}>
            <option value="">Select team…</option>
            {visibleTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            type="date"
            value={date}
            onChange={e => changeDate(e.target.value)}
            style={dateInput}
          />
        </div>

        {/* Student list */}
        {teamId && teamStudents.length > 0 ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Column labels */}
              <div className="roll-head" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', padding: '0 12px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Student</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Status</span>
              </div>

              {teamStudents.map((student, i) => {
                const current = statusMap[student.id] ?? 'present'
                return (
                  <div
                    key={student.id}
                    className="roll-row"
                    style={{
                      padding: '10px 12px', borderRadius: 10,
                      backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                  >
                    {/* Avatar + name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        backgroundColor: student.academy === 'MFA' ? 'rgba(22,163,74,0.15)' : 'rgba(249,115,22,0.15)',
                        border: `1.5px solid ${student.academy === 'MFA' ? 'rgba(22,163,74,0.3)' : 'rgba(249,115,22,0.3)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: student.academy === 'MFA' ? '#16a34a' : '#f97316',
                        fontWeight: 700, fontSize: 13,
                      }}>
                        {initials(student.name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: 0 }}>{student.name}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>#{student.jersey_number} · {student.position}</p>
                      </div>
                    </div>

                    {/* Status pills */}
                    <div className="roll-pills">
                      {(['present', 'late', 'absent'] as Status[]).map(s => (
                        <StatusPill
                          key={s}
                          status={s}
                          active={current === s}
                          onClick={() => setStatusMap(p => ({ ...p, [student.id]: s }))}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary row + save */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 12,
            }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {(['present', 'late', 'absent'] as Status[]).map(s => {
                  const count = Object.values(statusMap).filter(v => v === s).length
                  const cfg   = STATUS[s]
                  return (
                    <span key={s} style={{ color: cfg.color, fontSize: 13, fontWeight: 600 }}>
                      {count} {cfg.label}
                    </span>
                  )
                })}
              </div>
              <button
                onClick={saveAttendance}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  backgroundColor: '#16a34a', color: '#fff',
                  border: 'none', borderRadius: 10, padding: '11px 24px',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <IconCheck size={16} stroke={2.5} />
                Save Attendance
              </button>
            </div>
          </>
        ) : teamId ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
            No students found in this team.
          </p>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            <IconUsers size={36} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, margin: 0 }}>Select a team to start taking attendance.</p>
          </div>
        )}
      </Card>
      )}

      {/* ══ STATS CARDS ════════════════════════════════════════════════════ */}
      <div className="stat-card-grid" style={{ marginBottom: 24 }}>
        {/* This week rate */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, margin: 0, letterSpacing: '0.5px' }}>This Week</p>
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconActivity size={16} style={{ color: '#16a34a' }} />
            </div>
          </div>
          <p style={{ color: 'var(--text-primary)', fontSize: 30, fontWeight: 800, margin: '0 0 2px' }}>{stats.weekRate}%</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>Attendance rate</p>
        </Card>

        {/* Most absent */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, margin: 0, letterSpacing: '0.5px' }}>Most Absent</p>
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconAlertCircle size={16} style={{ color: '#ef4444' }} />
            </div>
          </div>
          {stats.mostAbsent ? (
            <>
              <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stats.mostAbsent.name}
              </p>
              <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{stats.mostAbsent.count} absences (30 days)</p>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No data yet</p>
          )}
        </Card>

        {/* Best team */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, margin: 0, letterSpacing: '0.5px' }}>Best Team</p>
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(245,197,24,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconTrophy size={16} style={{ color: '#f5c518' }} />
            </div>
          </div>
          {stats.bestTeam ? (
            <>
              <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>{stats.bestTeam.name}</p>
              <p style={{ color: '#f5c518', fontSize: 12, margin: 0 }}>{stats.bestTeam.rate}% rate (30 days)</p>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No data yet</p>
          )}
        </Card>

        {/* Total sessions */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, margin: 0, letterSpacing: '0.5px' }}>Sessions (30d)</p>
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconCalendarStats size={16} style={{ color: '#3b82f6' }} />
            </div>
          </div>
          <p style={{ color: 'var(--text-primary)', fontSize: 30, fontWeight: 800, margin: '0 0 2px' }}>{stats.totalSessions}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>Across all teams</p>
        </Card>
      </div>

      {/* ══ ATTENDANCE HISTORY ═════════════════════════════════════════════ */}
      <Card style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 700, margin: 0 }}>Attendance History</h2>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
              <IconFilter size={14} />
              <span style={{ fontSize: 12 }}>Filter:</span>
            </div>
            <select value={histTeam} onChange={e => setHistTeam(e.target.value)} style={sel}>
              <option value="All">All Teams</option>
              {visibleTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input
              type="date" value={histFrom}
              onChange={e => setHistFrom(e.target.value)}
              placeholder="From" style={{ ...dateInput, width: 140 }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>
            <input
              type="date" value={histTo}
              onChange={e => setHistTo(e.target.value)}
              placeholder="To" style={{ ...dateInput, width: 140 }}
            />
            {(histTeam !== 'All' || histFrom || histTo) && (
              <button onClick={() => { setHistTeam('All'); setHistFrom(''); setHistTo('') }}
                style={{ background: 'none', border: 'none', color: '#f5c518', fontSize: 12, cursor: 'pointer' }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>No sessions match your filters.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  {['Date', 'Team', 'Coach', 'Present', 'Late', 'Absent', 'Rate', ''].map(h => (
                    <th key={h} style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', padding: '0 0 10px', textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(session => {
                  const counts  = sessionCounts(session.records)
                  const rate    = sessionRate(session.records)
                  const isOpen  = expandedId === session.id
                  const rateCol = rate >= 80 ? '#16a34a' : rate >= 60 ? '#f5c518' : '#ef4444'

                  return (
                    <React.Fragment key={session.id}>
                      <tr
                        className="hist-row"
                        onClick={() => setExpandedId(isOpen ? null : session.id)}
                      >
                        <td style={{ padding: '12px 0', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{session.date}</td>
                        <td style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            backgroundColor: session.team_name.startsWith('MFA') ? 'rgba(22,163,74,0.15)' : 'rgba(249,115,22,0.15)',
                            color:           session.team_name.startsWith('MFA') ? '#16a34a' : '#f97316',
                          }}>
                            {session.team_name}
                          </span>
                        </td>
                        <td style={{ padding: '12px 0', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13 }}>{session.coach}</td>
                        <td style={{ padding: '12px 0', borderTop: '1px solid var(--border)', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>{counts.present}</td>
                        <td style={{ padding: '12px 0', borderTop: '1px solid var(--border)', color: '#f5c518', fontSize: 13, fontWeight: 600 }}>{counts.late}</td>
                        <td style={{ padding: '12px 0', borderTop: '1px solid var(--border)', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{counts.absent}</td>
                        <td style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                          <span style={{ color: rateCol, fontSize: 14, fontWeight: 700 }}>{rate}%</span>
                        </td>
                        <td style={{ padding: '12px 0', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                          {isOpen
                            ? <IconChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
                            : <IconChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isOpen && (
                        <tr key={`${session.id}-exp`}>
                          <td colSpan={8} style={{ padding: '0 0 12px', borderTop: 'none' }}>
                            <div style={{
                              backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)',
                              borderRadius: 10, padding: '16px 20px',
                              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: 10,
                            }}>
                              {Object.entries(session.records).map(([sid, status]) => {
                                const name = session.student_names[sid] ?? `Student ${sid}`
                                const cfg  = STATUS[status]
                                return (
                                  <div key={sid} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    backgroundColor: cfg.bg, borderRadius: 8, padding: '8px 12px',
                                  }}>
                                    <div style={{
                                      width: 28, height: 28, borderRadius: '50%',
                                      backgroundColor: 'rgba(0,0,0,0.2)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: cfg.color, fontWeight: 700, fontSize: 10,
                                    }}>
                                      {initials(name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                                      <p style={{ color: cfg.color, fontSize: 11, margin: 0, fontWeight: 600 }}>{cfg.label}</p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toast && <Toast message={toast} kind={toastKind} onDone={hideDismiss} />}
    </div>
  )
}
