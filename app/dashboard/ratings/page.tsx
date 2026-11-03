'use client'

import { useState, useEffect, useMemo } from 'react'
import { IconStar, IconUsers, IconX, IconCheck } from '@tabler/icons-react'
import { TEAMS, loadAllStudents, generateRatings, teamName, type StudentRow, type RatingEntry } from '../students/data'
import { useRoster } from '../hooks/useRoster'
import { toast } from '../components/toast'
import { useModal, modalOverlayProps } from '../hooks/useModal'
import { getCurrentUser } from '@/lib/auth'

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(n: string) { return n.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) }
function acColor(tid: string) { return TEAMS.find(t => t.id === tid)?.academy === 'MBA' ? '#f97316' : '#16a34a' }

function ratingColor(v: number) {
  if (v >= 8) return '#16a34a'
  if (v >= 5) return '#f5c518'
  return '#ef4444'
}

function getLatestOverall(student: StudentRow): number {
  try {
    const stored: RatingEntry[] = JSON.parse(localStorage.getItem(`mila_ratings_${student.id}`) ?? '[]')
    if (stored.length > 0) return stored[0].overall
  } catch {}
  const gen = generateRatings(student.id, student.overall_rating)
  return gen[0]?.overall ?? 0
}

// ── Rating Bar ────────────────────────────────────────────────────────────────

function RatingBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = (value / max) * 100
  const col = ratingColor(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, backgroundColor: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: col, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ color: col, fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{value.toFixed(1)}</span>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <style>{`@keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:.9} }`}</style>
      {[1,2,3].map(i => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: i > 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--border)', animation: 'shimmer 1.5s ease infinite', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 13, width: '60%', backgroundColor: 'var(--border)', borderRadius: 4, marginBottom: 6, animation: 'shimmer 1.5s ease infinite' }} />
            <div style={{ height: 6, backgroundColor: 'var(--border)', borderRadius: 3, animation: 'shimmer 1.5s ease infinite' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Rate Session Modal ────────────────────────────────────────────────────────

interface SliderState { technique: number; fitness: number; attitude: number; teamwork: number }
const DEFAULT_SLIDERS: SliderState = { technique: 7, fitness: 7, attitude: 7, teamwork: 7 }

function overall(s: SliderState) {
  return parseFloat(((s.technique + s.fitness + s.attitude + s.teamwork) / 4).toFixed(1))
}

function RateSessionModal({
  students, coachName, onSave, onClose,
}: { students: StudentRow[]; coachName: string; onSave: () => void; onClose: () => void }) {
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0])
  const [ratings, setRatings] = useState<Record<string, SliderState>>(
    () => Object.fromEntries(students.map(s => [s.id, { ...DEFAULT_SLIDERS }]))
  )
  const [notes, setNotes] = useState('')

  const FIELD: React.CSSProperties = { width: '100%', backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }
  const LBL: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', display: 'block', marginBottom: 4 }

  function setSlider(sid: string, field: keyof SliderState, val: number) {
    setRatings(p => ({ ...p, [sid]: { ...p[sid], [field]: val } }))
  }

  function save() {
    students.forEach(s => {
      const sl = ratings[s.id] ?? DEFAULT_SLIDERS
      const entry: RatingEntry = {
        id: `r-${Date.now()}-${s.id}`, date, coach: coachName,
        technique: sl.technique, fitness: sl.fitness, attitude: sl.attitude, teamwork: sl.teamwork,
        overall: overall(sl), notes,
      }
      try {
        const existing: RatingEntry[] = JSON.parse(localStorage.getItem(`mila_ratings_${s.id}`) ?? '[]')
        localStorage.setItem(`mila_ratings_${s.id}`, JSON.stringify([entry, ...existing]))
      } catch {}
    })
    toast(`Ratings saved for ${students.length} students`)
    onSave()
  }

  const SLIDER_FIELDS: Array<{ key: keyof SliderState; label: string }> = [
    { key: 'technique', label: 'Technique' },
    { key: 'fitness',   label: 'Fitness'   },
    { key: 'attitude',  label: 'Attitude'  },
    { key: 'teamwork',  label: 'Teamwork'  },
  ]

  useModal(onClose)

  return (
    <div {...modalOverlayProps} aria-label="Rate session" style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '92dvh', overflowY: 'auto', padding: 'clamp(18px, 5vw, 28px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: '0 0 2px' }}>Rate Session</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>{students.length} students · each scored 1–10</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <label style={LBL}>SESSION DATE</label>
            <input type="date" style={FIELD} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={LBL}>SESSION NOTES</label>
            <input style={FIELD} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes for this session…" />
          </div>
        </div>

        <style>{`
          .rating-slider { -webkit-appearance:none; appearance:none; height:4px; border-radius:2px; outline:none; cursor:pointer; }
          .rating-slider::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#f5c518; cursor:pointer; }
          .rating-slider::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:#f5c518; cursor:pointer; border:none; }
        `}</style>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {students.map(s => {
            const sl = ratings[s.id] ?? DEFAULT_SLIDERS
            const ov = overall(sl)
            const col = acColor(s.team_id)
            return (
              <div key={s.id} style={{ backgroundColor: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, backgroundColor: `${col}1a`, border: `1.5px solid ${col}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: col, fontSize: 11, fontWeight: 700 }}>
                    {initials(s.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: 0 }}>{s.name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>#{s.jersey_number} · {s.position}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: ratingColor(ov), fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{ov.toFixed(1)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 600 }}>OVERALL</div>
                  </div>
                </div>

                <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px 16px' }}>
                  {SLIDER_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>{sl[key]}</span>
                      </div>
                      <input
                        type="range" min={1} max={10} step={1}
                        value={sl[key]}
                        onChange={e => setSlider(s.id, key, Number(e.target.value))}
                        className="rating-slider"
                        style={{ width: '100%', background: `linear-gradient(to right, ${ratingColor(sl[key])} ${(sl[key]-1)/9*100}%, var(--border) ${(sl[key]-1)/9*100}%)` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={save} style={{ marginTop: 20, width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700, backgroundColor: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <IconCheck size={16} /> Save Session Ratings
        </button>
      </div>
    </div>
  )
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

function Leaderboard({ students }: { students: StudentRow[] }) {
  const [refresh, setRefresh] = useState(0)

  const ranked = useMemo(() => {
    return students
      .map(s => ({ ...s, score: getLatestOverall(s) }))
      .sort((a, b) => b.score - a.score)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, refresh])

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => setRefresh(r => r + 1)} style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, padding: '7px 14px', borderRadius: 8, cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>
      <div className="table-scroll" style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              {['#', 'Player', 'Team', 'Technique', 'Fitness', 'Attitude', 'Teamwork', 'Overall'].map(h => (
                <th key={h} style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', padding: '12px 16px', textAlign: h === '#' || h === 'Overall' || h === 'Technique' || h === 'Fitness' || h === 'Attitude' || h === 'Teamwork' ? 'center' : 'left' }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((s, i) => {
              const col = acColor(s.team_id)
              let latestEntry: RatingEntry | null = null
              try {
                const stored: RatingEntry[] = JSON.parse(localStorage.getItem(`mila_ratings_${s.id}`) ?? '[]')
                latestEntry = stored[0] ?? null
              } catch {}
              if (!latestEntry) {
                const gen = generateRatings(s.id, s.overall_rating)
                latestEntry = gen[0] ?? null
              }
              const scoreColor = ratingColor(s.score)

              return (
                <tr key={s.id} style={{ backgroundColor: i < 3 ? `${scoreColor}08` : 'transparent' }}>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <span style={{ fontSize: i < 3 ? 18 : 13, color: i < 3 ? undefined : 'var(--text-muted)', fontWeight: 700 }}>
                      {i < 3 ? medals[i] : i + 1}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, backgroundColor: `${col}1a`, border: `1.5px solid ${col}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: col, fontSize: 10, fontWeight: 700 }}>
                        {initials(s.name)}
                      </div>
                      <div>
                        <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: 0 }}>{s.name}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>#{s.jersey_number}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ backgroundColor: `${col}1a`, color: col, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{teamName(s.team_id)}</span>
                  </td>
                  {(['technique', 'fitness', 'attitude', 'teamwork'] as const).map(field => (
                    <td key={field} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                      <span style={{ color: ratingColor(latestEntry?.[field] ?? 5), fontSize: 13, fontWeight: 600 }}>
                        {latestEntry?.[field] ?? '—'}
                      </span>
                    </td>
                  ))}
                  <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <span style={{ color: scoreColor, fontSize: 16, fontWeight: 900 }}>{s.score.toFixed(1)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RatingsPage() {
  const [tab,         setTab]         = useState<'ratings' | 'leaderboard'>('ratings')
  const [teamId,      setTeamId]      = useState('')
  const [students,    setStudents]    = useState<StudentRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [coachName,   setCoachName]   = useState('Coach')
  const rosterVersion = useRoster()

  useEffect(() => {
    setTimeout(() => {
      const authUser = getCurrentUser()
      setCoachName(authUser?.name ?? 'Coach')
      const all = loadAllStudents()
      if (authUser?.role === 'coach' && authUser.teamId) {
        setStudents(all.filter(s => s.team_id === authUser.teamId))
        setTeamId(authUser.teamId)
      } else if (authUser?.role === 'parent' || authUser?.role === 'student') {
        setStudents(all.filter(s => String(s.id) === String(authUser.studentId)))
        const own = all.find(s => String(s.id) === String(authUser.studentId))
        if (own) setTeamId(own.team_id)
      } else {
        setStudents(all)
      }
      setLoading(false)
    }, 400)
  }, [rosterVersion])

  const teamStudents = useMemo(() => students.filter(s => s.team_id === teamId), [students, teamId])

  const SEL: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8,
    color: 'var(--text-secondary)', fontSize: 13, padding: '9px 32px 9px 12px', outline: 'none',
    appearance: 'none', cursor: 'pointer', minWidth: 160,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 010 1.659l-4.796 5.48a1 1 0 01-1.506 0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '11px',
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Ratings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Track player performance across all skill dimensions.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, backgroundColor: 'var(--bg-card)', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        {([['ratings', '📊 Team Ratings'], ['leaderboard', '🏆 Leaderboard']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
            backgroundColor: tab === key ? 'var(--bg-hover)' : 'transparent',
            color: tab === key ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
            transition: 'all 0.15s ease',
          }}>{label}</button>
        ))}
      </div>

      {/* ── RATINGS TAB ─────────────────────────────────────────────── */}
      {tab === 'ratings' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} style={SEL}>
              <option value="">Select team…</option>
              {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {teamId && teamStudents.length > 0 && (
              <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#f5c518', color: '#000', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <IconStar size={15} /> Rate Session
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton /><Skeleton />
            </div>
          ) : !teamId ? (
            <div style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '48px 0', textAlign: 'center' }}>
              <IconUsers size={40} style={{ color: 'var(--border)', marginBottom: 12 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Select a team to view their ratings.</p>
            </div>
          ) : teamStudents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No students in this team.</p>
          ) : (
            <div style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {teamStudents.map((s, i) => {
                const col = acColor(s.team_id)
                const ov = getLatestOverall(s)
                const ovCol = ratingColor(ov)

                let latest: RatingEntry | null = null
                try {
                  const stored: RatingEntry[] = JSON.parse(localStorage.getItem(`mila_ratings_${s.id}`) ?? '[]')
                  latest = stored[0] ?? null
                } catch {}
                if (!latest) {
                  const gen = generateRatings(s.id, s.overall_rating)
                  latest = gen[0] ?? null
                }

                return (
                  <div key={s.id} style={{ padding: '16px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, backgroundColor: `${col}1a`, border: `1.5px solid ${col}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: col, fontSize: 12, fontWeight: 700 }}>
                        {initials(s.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>{s.name}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>#{s.jersey_number} · {s.position}</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: ovCol, fontSize: 22, fontWeight: 900, margin: 0, lineHeight: 1 }}>{ov.toFixed(1)}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, margin: 0 }}>OVERALL</p>
                      </div>
                    </div>
                    <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '6px 20px' }}>
                      {([['Technique', latest?.technique], ['Fitness', latest?.fitness], ['Attitude', latest?.attitude], ['Teamwork', latest?.teamwork]] as [string, number | undefined][]).map(([label, val]) => (
                        <div key={label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</span>
                          </div>
                          <RatingBar value={val ?? 0} />
                        </div>
                      ))}
                    </div>
                    {latest?.date && <p style={{ color: 'var(--text-muted)', fontSize: 10, margin: '8px 0 0', textAlign: 'right' }}>Last rated: {latest.date}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD TAB ─────────────────────────────────────────── */}
      {tab === 'leaderboard' && (
        loading ? <Skeleton /> : <Leaderboard students={students} />
      )}

      {/* Modal */}
      {showModal && teamStudents.length > 0 && (
        <RateSessionModal
          students={teamStudents}
          coachName={coachName}
          onSave={() => setShowModal(false)}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
