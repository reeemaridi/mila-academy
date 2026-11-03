'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  IconMapPin, IconCalendar, IconClock, IconPlus,
  IconTrophy, IconChevronDown, IconChevronUp, IconUsers, IconX,
} from '@tabler/icons-react'
import { TEAMS, loadAllStudents, type StudentRow } from '../students/data'
import { useRoster } from '../hooks/useRoster'
import { useSelectedAcademy } from '@/lib/use-session'
import { DUMMY_MATCHES, type MatchRecord, type Scorer } from './data'
import { useModal, modalOverlayProps } from '../hooks/useModal'

type FormationKey = '4-3-3' | '4-4-2'
interface FSlot { label: string; x: number; y: number }

const FORMATIONS: Record<FormationKey, FSlot[]> = {
  '4-3-3': [
    { label: 'GK', x: 50, y: 87 },
    { label: 'RB', x: 20, y: 70 }, { label: 'CB', x: 37, y: 70 },
    { label: 'CB', x: 63, y: 70 }, { label: 'LB', x: 80, y: 70 },
    { label: 'CM', x: 27, y: 50 }, { label: 'CM', x: 50, y: 44 }, { label: 'CM', x: 73, y: 50 },
    { label: 'RW', x: 17, y: 22 }, { label: 'ST', x: 50, y: 14 }, { label: 'LW', x: 83, y: 22 },
  ],
  '4-4-2': [
    { label: 'GK', x: 50, y: 87 },
    { label: 'RB', x: 20, y: 70 }, { label: 'CB', x: 37, y: 70 },
    { label: 'CB', x: 63, y: 70 }, { label: 'LB', x: 80, y: 70 },
    { label: 'RM', x: 17, y: 50 }, { label: 'CM', x: 37, y: 50 },
    { label: 'CM', x: 63, y: 50 }, { label: 'LM', x: 83, y: 50 },
    { label: 'ST', x: 35, y: 18 }, { label: 'ST', x: 65, y: 18 },
  ],
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(n: string) { return n.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) }
function isoToday() { return new Date().toISOString().split('T')[0] }
function daysUntil(dateStr: string) {
  const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  return d
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtElapsed(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
function matchResult(m: MatchRecord): 'win' | 'draw' | 'loss' {
  if (m.score_us > m.score_them) return 'win'
  if (m.score_us < m.score_them) return 'loss'
  return 'draw'
}
const RESULT_CFG = {
  win:  { label: 'W', color: '#16a34a', bg: 'rgba(22,163,74,0.15)' },
  draw: { label: 'D', color: '#888',    bg: 'rgba(128,128,128,0.15)' },
  loss: { label: 'L', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
}
function academyColor(id: string) {
  return TEAMS.find(t => t.id === id)?.academy === 'MBA' ? '#f97316' : '#16a34a'
}

// ── Card wrapper ───────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, ...style }}>{children}</div>
}

// ── Modal overlay ──────────────────────────────────────────────────────────────

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useModal(onClose)
  return (
    <div {...modalOverlayProps} style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16,
          width: '100%', maxWidth: wide ? 900 : 520,
          maxHeight: '90dvh', overflowY: 'auto',
          padding: 'clamp(18px, 5vw, 28px)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconX size={20} />
      </button>
    </div>
  )
}

// ── Field styles ───────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  width: '100%', backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8,
  color: 'var(--text-secondary)', fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
  colorScheme: 'dark',
}
const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 5 }
const selStyle: React.CSSProperties = {
  ...fieldStyle, appearance: 'none', cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 010 1.659l-4.796 5.48a1 1 0 01-1.506 0z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '11px', paddingRight: 32,
}

// ── Schedule Match Modal ───────────────────────────────────────────────────────

function ScheduleMatchModal({ onSave, onClose }: { onSave: (m: MatchRecord) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    opponent: '', date: isoToday(), time: '15:00',
    location: '', team_id: 'mfa-u17', home_away: 'home' as 'home' | 'away',
  })
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function save() {
    if (!form.opponent.trim() || !form.date || !form.location.trim()) return
    const team = TEAMS.find(t => t.id === form.team_id)!
    const m: MatchRecord = {
      id: `m-${Date.now()}`, team_id: form.team_id, team_name: team.name,
      opponent: form.opponent.trim(), date: form.date, time: form.time,
      location: form.location.trim(), home_away: form.home_away,
      status: 'upcoming', score_us: 0, score_them: 0,
      lineup: [], scorers: [], opp_goal_minutes: [], coach_notes: '',
      live_started_at: '', created_at: isoToday(),
    }
    onSave(m)
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Schedule Match" onClose={onClose} />
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <label style={labelStyle}>OPPONENT NAME</label>
          <input style={fieldStyle} value={form.opponent} onChange={e => set('opponent', e.target.value)} placeholder="e.g. Al-Nejmeh SC" />
        </div>
        <div className="mt-form-2">
          <div>
            <label style={labelStyle}>DATE</label>
            <input type="date" style={fieldStyle} value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>TIME</label>
            <input type="time" style={fieldStyle} value={form.time} onChange={e => set('time', e.target.value)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>LOCATION</label>
          <input style={fieldStyle} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Beirut Municipal Stadium" />
        </div>
        <div className="mt-form-2">
          <div>
            <label style={labelStyle}>TEAM</label>
            <select style={selStyle} value={form.team_id} onChange={e => set('team_id', e.target.value)}>
              {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>HOME / AWAY</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              {(['home', 'away'] as const).map(v => (
                <button key={v} onClick={() => set('home_away', v)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${form.home_away === v ? '#f5c518' : 'var(--border)'}`,
                  backgroundColor: form.home_away === v ? 'rgba(245,197,24,0.12)' : 'var(--bg-card)',
                  color: form.home_away === v ? '#f5c518' : 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={save} style={{
          marginTop: 4, width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
          backgroundColor: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          Save Match
        </button>
      </div>
    </Modal>
  )
}

// ── Pitch Canvas ───────────────────────────────────────────────────────────────

function PitchCanvas({
  slots, lineup, students, onSlotClick,
}: {
  slots: FSlot[]
  lineup: (string | null)[]
  students: StudentRow[]
  onSlotClick: (idx: number) => void
}) {
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '3/4',
      backgroundColor: '#1a6b2a', borderRadius: 10, overflow: 'hidden',
      border: '2px solid #145220', flexShrink: 0,
    }}>
      {/* Outer border */}
      <div style={{ position: 'absolute', inset: 8, border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 2 }} />
      {/* Center line */}
      <div style={{ position: 'absolute', top: '50%', left: 8, right: 8, height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      {/* Center circle */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: '28%', paddingBottom: '28%',
        transform: 'translate(-50%,-50%)',
        borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.35)',
      }} />
      {/* Top penalty area */}
      <div style={{ position: 'absolute', top: 8, left: '22%', right: '22%', height: '18%', border: '1.5px solid rgba(255,255,255,0.35)', borderTop: 'none' }} />
      {/* Bottom penalty area */}
      <div style={{ position: 'absolute', bottom: 8, left: '22%', right: '22%', height: '18%', border: '1.5px solid rgba(255,255,255,0.35)', borderBottom: 'none' }} />
      {/* Top goal box */}
      <div style={{ position: 'absolute', top: 8, left: '38%', right: '38%', height: '6%', border: '1.5px solid rgba(255,255,255,0.35)', borderTop: 'none' }} />
      {/* Bottom goal box */}
      <div style={{ position: 'absolute', bottom: 8, left: '38%', right: '38%', height: '6%', border: '1.5px solid rgba(255,255,255,0.35)', borderBottom: 'none' }} />

      {/* OPPONENT label */}
      <p style={{ position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: 0, pointerEvents: 'none' }}>OPPONENT</p>
      {/* MILA label */}
      <p style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: 0, pointerEvents: 'none' }}>MILA</p>

      {/* Slots */}
      {slots.map((slot, idx) => {
        const sid = lineup[idx]
        const st = sid ? students.find(s => s.id === sid) : null
        return (
          <div key={idx} onClick={() => onSlotClick(idx)} style={{
            position: 'absolute',
            left: `${slot.x}%`, top: `${slot.y}%`,
            transform: 'translate(-50%,-50%)',
            width: 34, height: 34, borderRadius: '50%',
            backgroundColor: st ? '#f5c518' : 'rgba(255,255,255,0.08)',
            border: `2px solid ${st ? '#d4a800' : 'rgba(255,255,255,0.4)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.15s ease', userSelect: 'none',
          }} title={st ? st.name : slot.label}>
            <span style={{ fontSize: 9, fontWeight: 800, color: st ? '#000' : 'rgba(255,255,255,0.7)', lineHeight: 1 }}>
              {st ? initials(st.name) : slot.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Lineup Modal ───────────────────────────────────────────────────────────────

function LineupModal({
  match, students, onSave, onClose,
}: {
  match: MatchRecord
  students: StudentRow[]
  onSave: (lineup: string[]) => void
  onClose: () => void
}) {
  const [formation, setFormation] = useState<FormationKey>('4-3-3')
  const teamStudents = students.filter(s => s.team_id === match.team_id)
  const slots = FORMATIONS[formation]

  // lineup: array of 11 student IDs (null = empty)
  const [lineup, setLineup] = useState<(string | null)[]>(() => {
    const init: (string | null)[] = Array(11).fill(null)
    match.lineup.slice(0, 11).forEach((id, i) => { init[i] = id })
    return init
  })

  const inLineup = new Set(lineup.filter(Boolean) as string[])
  const bench = teamStudents.filter(s => !inLineup.has(s.id))

  function addPlayer(studentId: string) {
    setLineup(prev => {
      const next = [...prev]
      const empty = next.indexOf(null)
      if (empty === -1) return prev
      next[empty] = studentId
      return next
    })
  }

  function removeSlot(idx: number) {
    setLineup(prev => { const n = [...prev]; n[idx] = null; return n })
  }

  function save() {
    onSave(lineup.filter(Boolean) as string[])
  }

  return (
    <Modal onClose={onClose} wide>
      <ModalHeader title={`Lineup — ${match.team_name} vs ${match.opponent}`} onClose={onClose} />

      {/* Formation selector */}
      <div className="scroll-row" style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <span style={{ ...labelStyle, alignSelf: 'center', marginBottom: 0, flexShrink: 0 }}>FORMATION:</span>
        {(['4-3-3', '4-4-2'] as FormationKey[]).map(f => (
          <button key={f} onClick={() => setFormation(f)} style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${formation === f ? '#f5c518' : 'var(--border)'}`,
            backgroundColor: formation === f ? 'rgba(245,197,24,0.12)' : 'var(--bg-card)',
            color: formation === f ? '#f5c518' : 'var(--text-muted)',
          }}>{f}</button>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12, alignSelf: 'center' }}>
          {lineup.filter(Boolean).length}/11 selected
        </span>
      </div>

      <div className="mt-lineup">
        {/* Pitch */}
        <PitchCanvas slots={slots} lineup={lineup} students={teamStudents} onSlotClick={removeSlot} />

        {/* Player list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ ...labelStyle, marginBottom: 8 }}>SQUAD — click to place</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 400 }}>
            {bench.map(s => (
              <button key={s.id} onClick={() => addPlayer(s.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8,
                padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s ease',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#f5c518')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: `${academyColor(s.team_id)}22`,
                  border: `1.5px solid ${academyColor(s.team_id)}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: academyColor(s.team_id), fontSize: 10, fontWeight: 700,
                }}>
                  {initials(s.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 10, margin: 0 }}>#{s.jersey_number} {s.position}</p>
                </div>
              </button>
            ))}
            {bench.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>All players placed</p>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '4px 0 0' }}>Click a player on the pitch to remove them</p>
        </div>
      </div>

      <button onClick={save} style={{
        marginTop: 20, width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 14,
        fontWeight: 700, backgroundColor: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer',
      }}>
        Save Lineup
      </button>
    </Modal>
  )
}

// ── Goal Scorer Modal ──────────────────────────────────────────────────────────

function GoalScorerModal({
  match, students, elapsed, onSelect, onClose,
}: {
  match: MatchRecord
  students: StudentRow[]
  elapsed: number
  onSelect: (scorer: Scorer | null) => void
  onClose: () => void
}) {
  const lineupStudents = students.filter(s => match.lineup.includes(s.id))
  const minute = Math.floor(elapsed / 60) + 1

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="⚽ Who Scored?" onClose={onClose} />
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px' }}>Minute {minute}&apos;</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lineupStudents.map(s => (
          <button key={s.id} onClick={() => onSelect({ id: s.id, name: s.name, minute })} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10,
            padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#16a34a')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              backgroundColor: 'rgba(22,163,74,0.15)', border: '1.5px solid rgba(22,163,74,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#16a34a', fontSize: 12, fontWeight: 700,
            }}>
              {initials(s.name)}
            </div>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: 0 }}>{s.name}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>#{s.jersey_number} · {s.position}</p>
            </div>
          </button>
        ))}
        <button onClick={() => onSelect(null)} style={{
          padding: '12px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          border: '0.5px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)',
        }}>
          Own Goal / Unknown
        </button>
      </div>
    </Modal>
  )
}

// ── End match confirmation ─────────────────────────────────────────────────────

function EndMatchModal({
  match, onConfirm, onClose,
}: { match: MatchRecord; onConfirm: (notes: string) => void; onClose: () => void }) {
  const [notes, setNotes] = useState('')
  const res = match.score_us > match.score_them ? 'Win' : match.score_us < match.score_them ? 'Loss' : 'Draw'
  const cfg = res === 'Win' ? RESULT_CFG.win : res === 'Loss' ? RESULT_CFG.loss : RESULT_CFG.draw

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="End Match" onClose={onClose} />
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 8px' }}>Final Score</p>
        <p style={{ color: 'var(--text-primary)', fontSize: 36, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-1px' }}>
          {match.score_us} – {match.score_them}
        </p>
        <span style={{
          display: 'inline-block', padding: '4px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700,
          backgroundColor: cfg.bg, color: cfg.color,
        }}>{res}</span>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>COACH NOTES</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Match summary, player performances…"
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </div>
      <button onClick={() => onConfirm(notes)} style={{
        width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
        backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer',
      }}>
        Confirm — End Match
      </button>
    </Modal>
  )
}

// ── Live Match Card ────────────────────────────────────────────────────────────

function LiveMatchCard({
  match, onGoal, onOppGoal, onEnd,
}: {
  match: MatchRecord
  onGoal: () => void
  onOppGoal: () => void
  onEnd: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const start = new Date(match.live_started_at).getTime()
    ref.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [match.live_started_at])

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a0a0a 0%, #1a1a0a 100%)',
      border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16,
      padding: 'clamp(18px, 5vw, 28px)', marginBottom: 24,
      boxShadow: '0 0 40px rgba(239,68,68,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444', fontSize: 11, fontWeight: 800, letterSpacing: '2px',
            padding: '4px 12px', borderRadius: 20,
            animation: 'livePulse 1.4s ease-in-out infinite',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
            LIVE
          </span>
          <span style={{ color: '#888', fontSize: 13 }}>{fmtDate(match.date)} · {match.time}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            backgroundColor: '#111', border: '0.5px solid #2a2a2a', borderRadius: 8,
            color: '#f5c518', fontSize: 16, fontWeight: 800, padding: '6px 14px', fontVariantNumeric: 'tabular-nums',
          }}>{fmtElapsed(elapsed)}</span>
          <button onClick={onEnd} style={{
            backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
          }}>
            End Match
          </button>
        </div>
      </div>

      {/* Score */}
      <div className="mt-score">
        {/* Mila side */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: academyColor(match.team_id), fontSize: 12, fontWeight: 700, letterSpacing: '1px', margin: '0 0 6px', textTransform: 'uppercase' }}>
            {match.team_name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <button onClick={onGoal} style={{
              width: 40, height: 40, borderRadius: '50%', fontSize: 22, lineHeight: 1,
              backgroundColor: 'rgba(22,163,74,0.15)', border: '1.5px solid rgba(22,163,74,0.4)',
              color: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</button>
            <span style={{ color: '#fff', fontSize: 56, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px', lineHeight: 1 }}>
              {match.score_us}
            </span>
          </div>
        </div>

        {/* Divider */}
        <span style={{ color: '#444', fontSize: 36, fontWeight: 300 }}>–</span>

        {/* Opponent side */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: 12, fontWeight: 700, letterSpacing: '1px', margin: '0 0 6px', textTransform: 'uppercase' }}>
            {match.opponent}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ color: '#fff', fontSize: 56, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px', lineHeight: 1 }}>
              {match.score_them}
            </span>
            <button onClick={onOppGoal} style={{
              width: 40, height: 40, borderRadius: '50%', fontSize: 22, lineHeight: 1,
              backgroundColor: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)',
              color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</button>
          </div>
        </div>
      </div>

      {/* Scorers */}
      {match.scorers.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ color: '#555', fontSize: 11, margin: '0 0 8px', fontWeight: 600, letterSpacing: '0.5px' }}>SCORERS</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {match.scorers.map((sc, i) => (
              <span key={i} style={{
                backgroundColor: 'rgba(22,163,74,0.1)', border: '0.5px solid rgba(22,163,74,0.25)',
                color: '#16a34a', fontSize: 12, padding: '3px 10px', borderRadius: 20,
              }}>
                ⚽ {sc.name} {sc.minute}&apos;
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Location */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: '#555', fontSize: 12 }}>
        <IconMapPin size={13} />
        {match.location}
        <span style={{ marginLeft: 8, color: match.home_away === 'home' ? '#16a34a' : '#f97316', fontSize: 11, fontWeight: 700 }}>
          {match.home_away.toUpperCase()}
        </span>
      </div>
    </div>
  )
}

// ── Upcoming Match Card ────────────────────────────────────────────────────────

function UpcomingCard({
  match, onViewLineup, onGoLive,
}: { match: MatchRecord; onViewLineup: () => void; onGoLive: () => void }) {
  const days = daysUntil(match.date)
  const acColor = academyColor(match.team_id)

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Team badge */}
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            backgroundColor: `${acColor}22`, border: `1.5px solid ${acColor}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: acColor, fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textAlign: 'center', lineHeight: 1.3,
          }}>
            {match.team_name.replace(' ', '\n')}
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {match.home_away === 'home' ? 'Home' : 'Away'} Match
            </p>
            <p style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>
              vs {match.opponent}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: 12 }}>
                <IconCalendar size={13} style={{ color: 'var(--text-muted)' }} />
                {fmtDate(match.date)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: 12 }}>
                <IconClock size={13} style={{ color: 'var(--text-muted)' }} />
                {match.time}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: 12 }}>
                <IconMapPin size={13} style={{ color: 'var(--text-muted)' }} />
                {match.location}
              </span>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {/* Countdown badge */}
          <span style={{
            backgroundColor: days <= 3 ? 'rgba(239,68,68,0.12)' : days <= 7 ? 'rgba(245,197,24,0.12)' : 'var(--bg)',
            border: `0.5px solid ${days <= 3 ? 'rgba(239,68,68,0.3)' : days <= 7 ? 'rgba(245,197,24,0.3)' : 'var(--border)'}`,
            color: days <= 3 ? '#ef4444' : days <= 7 ? '#f5c518' : 'var(--text-secondary)',
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
          }}>
            {days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `${days} days`}
          </span>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onViewLineup} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              backgroundColor: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8,
              color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, padding: '8px 14px', cursor: 'pointer',
            }}>
              <IconUsers size={13} /> Lineup {match.lineup.length > 0 ? `(${match.lineup.length})` : ''}
            </button>
            <button onClick={onGoLive} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, color: '#ef4444', fontSize: 12, fontWeight: 700, padding: '8px 14px', cursor: 'pointer',
            }}>
              ● Go Live
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Result Card (expandable) ───────────────────────────────────────────────────

function ResultCard({ match, students }: { match: MatchRecord; students: StudentRow[] }) {
  const [open, setOpen] = useState(false)
  const res = matchResult(match)
  const cfg = RESULT_CFG[res]
  const acColor = academyColor(match.team_id)

  return (
    <Card style={{ overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}
      >
        {/* Result badge */}
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          backgroundColor: cfg.bg, border: `1px solid ${cfg.color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: cfg.color, fontSize: 15, fontWeight: 900,
        }}>{cfg.label}</div>

        {/* Match info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }}>vs {match.opponent}</span>
            <span style={{ color: acColor, fontSize: 11, fontWeight: 700 }}>{match.team_name}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtDate(match.date)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
              <IconMapPin size={12} />{match.location}
            </span>
            <span style={{
              color: match.home_away === 'home' ? '#16a34a' : '#f97316',
              fontSize: 11, fontWeight: 700,
            }}>{match.home_away.toUpperCase()}</span>
          </div>
        </div>

        {/* Score */}
        <span style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
          {match.score_us}–{match.score_them}
        </span>
        {open ? <IconChevronUp size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <IconChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
      </div>

      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
          <div className="mt-two" style={{ marginTop: 16 }}>
            {/* Scorers */}
            <div>
              <p style={{ ...labelStyle, marginBottom: 8 }}>SCORERS</p>
              {match.scorers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No goals scored</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {match.scorers.map((sc, i) => (
                    <span key={i} style={{ color: '#16a34a', fontSize: 12 }}>⚽ {sc.name} {sc.minute}&apos;</span>
                  ))}
                  {match.opp_goal_minutes.map((min, i) => (
                    <span key={`opp-${i}`} style={{ color: '#ef4444', fontSize: 12 }}>⚽ {match.opponent} {min}&apos;</span>
                  ))}
                </div>
              )}
            </div>

            {/* Lineup */}
            <div>
              <p style={{ ...labelStyle, marginBottom: 8 }}>LINEUP ({match.lineup.length})</p>
              {match.lineup.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No lineup recorded</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {match.lineup.map(sid => {
                    const s = students.find(st => st.id === sid)
                    return s ? (
                      <span key={sid} style={{
                        backgroundColor: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 6,
                        color: 'var(--text-secondary)', fontSize: 11, padding: '3px 8px',
                      }}>
                        #{s.jersey_number} {s.name}
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Coach notes */}
          {match.coach_notes && (
            <div style={{ marginTop: 16, padding: '12px 14px', backgroundColor: 'var(--bg)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
              <p style={{ ...labelStyle, marginBottom: 4 }}>COACH NOTES</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>{match.coach_notes}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── League Table ───────────────────────────────────────────────────────────────

function LeagueTable({ results }: { results: MatchRecord[] }) {
  const standings = useMemo(() => {
    const map: Record<string, { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number }> = {}
    results.forEach(m => {
      if (!map[m.team_name]) map[m.team_name] = { team: m.team_name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 }
      const r = map[m.team_name]
      r.played++
      r.gf += m.score_us
      r.ga += m.score_them
      const res = matchResult(m)
      if (res === 'win')  r.won++
      else if (res === 'draw') r.drawn++
      else r.lost++
    })
    return Object.values(map)
      .map(r => ({ ...r, gd: r.gf - r.ga, points: r.won * 3 + r.drawn }))
      .sort((a, b) => b.points - a.points || b.gd - a.gd)
  }, [results])

  if (standings.length === 0) return null

  return (
    <Card style={{ padding: '20px 24px', marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <IconTrophy size={18} style={{ color: '#f5c518' }} />
        <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, margin: 0 }}>League Standings</h3>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead>
            <tr>
              {['#', 'Team', 'P', 'W', 'D', 'L', 'GD', 'Pts'].map(h => (
                <th key={h} style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', padding: '0 8px 10px', textAlign: h === 'Team' ? 'left' : 'center' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <tr key={row.team}>
                <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>{i + 1}</td>
                <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      backgroundColor: `${academyColor(TEAMS.find(t => t.name === row.team)?.id ?? '')}22`,
                      border: `1px solid ${academyColor(TEAMS.find(t => t.name === row.team)?.id ?? '')}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 7, fontWeight: 800, color: academyColor(TEAMS.find(t => t.name === row.team)?.id ?? ''),
                    }}>
                      {row.team.split(' ')[0]}
                    </div>
                    {row.team}
                  </div>
                </td>
                {[row.played, row.won, row.drawn, row.lost].map((v, j) => (
                  <td key={j} style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>{v}</td>
                ))}
                <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                  <span style={{ color: row.gd > 0 ? '#16a34a' : row.gd < 0 ? '#ef4444' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
                    {row.gd > 0 ? '+' : ''}{row.gd}
                  </span>
                </td>
                <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                  <span style={{ color: '#f5c518', fontSize: 14, fontWeight: 800 }}>{row.points}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const selectedAcademy = useSelectedAcademy()

  const [tab, setTab] = useState<'upcoming' | 'results'>('upcoming')
  const [matches, setMatches] = useState<MatchRecord[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('mila_matches') ?? '[]') as MatchRecord[]
      // Merge stored with dummy (stored takes precedence by id)
      const storedIds = new Set(stored.map(m => m.id))
      return [...stored, ...DUMMY_MATCHES.filter(m => !storedIds.has(m.id))]
        .sort((a, b) => b.date.localeCompare(a.date))
    } catch {
      return DUMMY_MATCHES
    }
  })
  const rosterVersion = useRoster()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const students = useMemo<StudentRow[]>(() => loadAllStudents(), [rosterVersion])

  // Modals
  const [showSchedule,    setShowSchedule]    = useState(false)
  const [lineupMatch,     setLineupMatch]     = useState<MatchRecord | null>(null)
  const [goalMatch,       setGoalMatch]       = useState<MatchRecord | null>(null)
  const [goalElapsed,     setGoalElapsed]     = useState(0)
  const [endMatch,        setEndMatch]        = useState<MatchRecord | null>(null)

  function persist(next: MatchRecord[]) {
    setMatches(next)
    try { localStorage.setItem('mila_matches', JSON.stringify(next)) } catch {}
  }

  function updateMatch(updated: MatchRecord) {
    persist(matches.map(m => m.id === updated.id ? updated : m))
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const academyMatches = useMemo(() => {
    if (selectedAcademy === 'Both') return matches
    return matches.filter(m => TEAMS.find(t => t.id === m.team_id)?.academy === selectedAcademy)
  }, [matches, selectedAcademy])

  const liveMatch  = useMemo(() => academyMatches.find(m => m.status === 'live') ?? null, [academyMatches])
  const upcoming   = useMemo(() => academyMatches.filter(m => m.status === 'upcoming').sort((a, b) => a.date.localeCompare(b.date)), [academyMatches])
  const results    = useMemo(() => academyMatches.filter(m => m.status === 'completed').sort((a, b) => b.date.localeCompare(a.date)), [academyMatches])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function addMatch(m: MatchRecord) {
    persist([m, ...matches])
    setShowSchedule(false)
  }

  function saveLineup(lineup: string[]) {
    if (!lineupMatch) return
    updateMatch({ ...lineupMatch, lineup })
    setLineupMatch(null)
  }

  function goLive(match: MatchRecord) {
    updateMatch({ ...match, status: 'live', live_started_at: new Date().toISOString() })
  }

  function handleGoal(forUs: boolean) {
    if (!liveMatch) return
    if (!forUs) {
      // Opponent goals have no scorer to pick — register immediately, no modal.
      const elapsed = Math.floor((Date.now() - new Date(liveMatch.live_started_at).getTime()) / 1000)
      const minute = Math.floor(elapsed / 60) + 1
      updateMatch({ ...liveMatch, score_them: liveMatch.score_them + 1, opp_goal_minutes: [...liveMatch.opp_goal_minutes, minute] })
      return
    }
    setGoalMatch(liveMatch)
    setGoalElapsed(Math.floor((Date.now() - new Date(liveMatch.live_started_at).getTime()) / 1000))
  }

  function registerGoal(scorer: Scorer | null) {
    if (!liveMatch) return
    const elapsed = Math.floor((Date.now() - new Date(liveMatch.live_started_at).getTime()) / 1000)
    const minute = Math.floor(elapsed / 60) + 1
    const s = scorer ?? { id: 'og', name: 'Unknown', minute }
    updateMatch({ ...liveMatch, score_us: liveMatch.score_us + 1, scorers: [...liveMatch.scorers, s] })
    setGoalMatch(null)
  }

  function confirmEndMatch(notes: string) {
    if (!liveMatch) return
    updateMatch({ ...liveMatch, status: 'completed', coach_notes: notes })
    setEndMatch(null)
  }

  const closeSched  = useCallback(() => setShowSchedule(false), [])
  const closeLineup = useCallback(() => setLineupMatch(null), [])
  const closeGoal   = useCallback(() => setGoalMatch(null), [])
  const closeEnd    = useCallback(() => setEndMatch(null), [])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <style>{`
        @keyframes livePulse {
          0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(239,68,68,0.4); }
          50%      { opacity:0.85; box-shadow:0 0 0 6px rgba(239,68,68,0); }
        }
        /* Lineup editor: the pitch and the squad list stack rather than
           squeezing the pitch into whatever 220px leaves behind. */
        .mt-lineup { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 20px; }
        @media (max-width: 720px) {
          .mt-lineup { grid-template-columns: minmax(0, 1fr); }
          .mt-lineup > div:last-child > div { max-height: 220px; }
        }
        /* Live scoreboard */
        .mt-score { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 16px; align-items: center; }
        .mt-score-num { font-size: 56px; }
        @media (max-width: 560px) {
          .mt-score { gap: 8px; }
          .mt-score-num { font-size: 40px; }
        }
        /* Scorers / cards columns under an expanded result */
        .mt-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
        @media (max-width: 520px) { .mt-two { grid-template-columns: minmax(0, 1fr); gap: 16px; } }
        /* Won / drawn / lost tallies */
        .mt-wdl { display: grid; grid-template-columns: repeat(3,minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 420px) { .mt-wdl { gap: 8px; } }
        /* Paired fields in the Schedule Match dialog */
        .mt-form-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
        @media (max-width: 520px) { .mt-form-2 { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Matches</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Schedule, track, and review match performances.</p>
        </div>
        <button onClick={() => setShowSchedule(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          backgroundColor: '#16a34a', color: '#fff',
          border: 'none', borderRadius: 10, padding: '11px 20px',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <IconPlus size={16} stroke={2.5} /> Schedule Match
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, backgroundColor: 'var(--bg-card)', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        {(['upcoming', 'results'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
            backgroundColor: tab === t ? 'var(--bg-hover)' : 'transparent',
            color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
            transition: 'all 0.15s ease', textTransform: 'capitalize',
          }}>
            {t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Results (${results.length})`}
          </button>
        ))}
      </div>

      {/* ── UPCOMING TAB ─────────────────────────────────────────────── */}
      {tab === 'upcoming' && (
        <div>
          {/* Live card always shown if active */}
          {liveMatch && (
            <LiveMatchCard
              match={liveMatch}
              onGoal={() => handleGoal(true)}
              onOppGoal={() => handleGoal(false)}
              onEnd={() => setEndMatch(liveMatch)}
            />
          )}

          {upcoming.length === 0 && !liveMatch && (
            <Card style={{ padding: 48, textAlign: 'center' }}>
              <IconCalendar size={40} style={{ color: 'var(--border)', marginBottom: 12 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>No upcoming matches scheduled.</p>
              <button onClick={() => setShowSchedule(true)} style={{
                marginTop: 16, backgroundColor: '#16a34a', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Schedule First Match
              </button>
            </Card>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {upcoming.map(m => (
              <UpcomingCard
                key={m.id}
                match={m}
                onViewLineup={() => setLineupMatch(m)}
                onGoLive={() => goLive(m)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── RESULTS TAB ──────────────────────────────────────────────── */}
      {tab === 'results' && (
        <div>
          {results.length === 0 ? (
            <Card style={{ padding: 48, textAlign: 'center' }}>
              <IconTrophy size={40} style={{ color: 'var(--border)', marginBottom: 12 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>No completed matches yet.</p>
            </Card>
          ) : (
            <>
              {/* Summary row */}
              <div className="mt-wdl" style={{ marginBottom: 20 }}>
                {[
                  { label: 'Wins',   val: results.filter(m => matchResult(m) === 'win').length,  color: '#16a34a' },
                  { label: 'Draws',  val: results.filter(m => matchResult(m) === 'draw').length, color: '#888'    },
                  { label: 'Losses', val: results.filter(m => matchResult(m) === 'loss').length, color: '#ef4444' },
                ].map(s => (
                  <Card key={s.label} style={{ padding: 16, textAlign: 'center' }}>
                    <p style={{ color: s.color, fontSize: 28, fontWeight: 900, margin: '0 0 4px' }}>{s.val}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, margin: 0 }}>{s.label}</p>
                  </Card>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.map(m => <ResultCard key={m.id} match={m} students={students} />)}
              </div>

              <LeagueTable results={results} />
            </>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {showSchedule && <ScheduleMatchModal onSave={addMatch} onClose={closeSched} />}

      {lineupMatch && (
        <LineupModal
          match={lineupMatch}
          students={students}
          onSave={saveLineup}
          onClose={closeLineup}
        />
      )}

      {goalMatch && (
        <GoalScorerModal
          match={goalMatch}
          students={students}
          elapsed={goalElapsed}
          onSelect={registerGoal}
          onClose={closeGoal}
        />
      )}

      {endMatch && (
        <EndMatchModal match={endMatch} onConfirm={confirmEndMatch} onClose={closeEnd} />
      )}
    </div>
  )
}
