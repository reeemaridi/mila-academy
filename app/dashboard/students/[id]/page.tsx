'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  IconArrowLeft, IconPhone, IconBrandWhatsapp, IconX, IconPlus,
  IconShieldLock, IconAward, IconStarFilled, IconStar, IconEdit,
  IconCheck, IconActivity, IconCreditCard, IconNotes, IconMedicalCross,
} from '@tabler/icons-react'
import {
  generateAttendance, generateRatings, generatePayments,
  type StudentRow, type RatingEntry, type PaymentEntry,
} from '../data'
import { useSession } from '@/lib/use-session'
import { fetchStudent, fetchTeams, type TeamRow } from '../api'
import { useModal, modalOverlayProps } from '../../hooks/useModal'

// ── Shared mini-components ─────────────────────────────────────────────────────

const ACAD_STYLE = {
  MFA: { bg: 'rgba(22,163,74,0.15)',  color: '#16a34a' },
  MBA: { bg: 'rgba(249,115,22,0.15)', color: '#f97316' },
}

const PAY_STYLE = {
  paid:    { bg: 'rgba(22,163,74,0.15)',  color: '#16a34a', label: 'Paid'    },
  unpaid:  { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Unpaid'  },
  partial: { bg: 'rgba(245,197,24,0.15)',color: '#f5c518', label: 'Partial' },
}

function Badge({ label, bg, color, size = 12 }: { label: string; bg: string; color: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 20,
      fontSize: size, fontWeight: 700,
      backgroundColor: bg, color,
    }}>
      {label}
    </span>
  )
}

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const hasHalf = rating % 1 >= 0.3
  const empty = 5 - full - (hasHalf ? 1 : 0)
  return (
    <span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle' }}>
      {Array.from({ length: full }).map((_, i) => <IconStarFilled key={`f${i}`} size={14} style={{ color: '#f5c518' }} />)}
      {hasHalf && <IconStarFilled size={14} style={{ color: '#f5c518', opacity: 0.45 }} />}
      {Array.from({ length: empty }).map((_, i) => <IconStar key={`e${i}`} size={14} style={{ color: 'var(--border)' }} />)}
    </span>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)',
      borderRadius: 12, ...style,
    }}>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{value || '—'}</span>
    </div>
  )
}

// ── Circular progress (Ratings tab) ───────────────────────────────────────────

function CircleRing({ label, score }: { label: string; score: number }) {
  const deg = (score / 10) * 360
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 86, height: 86, borderRadius: '50%', position: 'relative',
        background: `conic-gradient(#f5c518 ${deg}deg, var(--border) 0deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 13, borderRadius: '50%',
          backgroundColor: 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#f5c518', fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{score}</span>
        </div>
      </div>
      <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>{label}</span>
    </div>
  )
}

// ── Attendance dot ──────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  present: { color: '#16a34a', label: 'Present' },
  absent:  { color: '#ef4444', label: 'Absent'  },
  late:    { color: '#f5c518', label: 'Late'    },
}

// ── Add Rating Modal ───────────────────────────────────────────────────────────

function RatingSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const pct = ((value - 1) / 9) * 100
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ color: '#f5c518', fontSize: 15, fontWeight: 700 }}>{value}/10</span>
      </div>
      <input
        type="range" min={1} max={10} value={value}
        onChange={e => onChange(+e.target.value)}
        className="rating-slider"
        style={{ background: `linear-gradient(to right, #f5c518 ${pct}%, var(--border) ${pct}%)` }}
      />
    </div>
  )
}

function AddRatingModal({
  studentId,
  onClose,
  onAdd,
}: {
  studentId: string
  onClose: () => void
  onAdd: (r: RatingEntry) => void
}) {
  const [scores, setScores] = useState({ technique: 7, fitness: 7, attitude: 7, teamwork: 7 })
  const [notes, setNotes]   = useState('')
  const overall = parseFloat(((scores.technique + scores.fitness + scores.attitude + scores.teamwork) / 4).toFixed(1))

  const set = (k: keyof typeof scores) => (v: number) => setScores(p => ({ ...p, [k]: v }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const entry: RatingEntry = {
      id: `r-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      coach: 'Coach (current)',
      ...scores,
      overall,
      notes,
    }
    try {
      const key  = `mila_ratings_${studentId}`
      const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as RatingEntry[]
      localStorage.setItem(key, JSON.stringify([entry, ...existing]))
    } catch {}
    onAdd(entry)
    onClose()
  }

  useModal(onClose)

  return (
    <div {...modalOverlayProps} aria-label="Add rating" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <style>{`
        .rating-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; border-radius: 2px; outline: none; cursor: pointer; }
        .rating-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #f5c518; cursor: pointer; border: 2px solid var(--bg-card); }
        .rating-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #f5c518; cursor: pointer; border: 2px solid var(--bg-card); }
      `}</style>
      <div style={{
        backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16,
        width: '100%', maxWidth: 440, overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: 0 }}>Add Rating</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 20 }}>
            <RatingSlider label="Technique" value={scores.technique} onChange={set('technique')} />
            <RatingSlider label="Fitness"   value={scores.fitness}   onChange={set('fitness')}   />
            <RatingSlider label="Attitude"  value={scores.attitude}  onChange={set('attitude')}  />
            <RatingSlider label="Teamwork"  value={scores.teamwork}  onChange={set('teamwork')}  />
          </div>
          {/* Overall preview */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: 'var(--bg)', border: '0.5px solid var(--border)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Overall Average</span>
            <span style={{ color: '#f5c518', fontSize: 22, fontWeight: 800 }}>{overall} <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 400 }}>/ 10</span></span>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Session notes (optional)…"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', padding: 12,
              backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, outline: 'none',
              resize: 'none', fontFamily: 'inherit', marginBottom: 20,
            }}
          />
          <button type="submit" style={{
            width: '100%', height: 46, borderRadius: 8, border: 'none',
            backgroundColor: '#f5c518', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            Save Rating
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Tab bodies ─────────────────────────────────────────────────────────────────

function OverviewTab({ student, teamDisplayName }: { student: StudentRow; teamDisplayName: string }) {
  const key = `mila_notes_${student.id}`
  const [notes, setNotes] = useState(() => student.notes || localStorage.getItem(key) || '')
  const [saved, setSaved]  = useState(false)

  function saveNotes() {
    localStorage.setItem(key, notes)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const dob    = new Date(student.dob)
  const age    = new Date().getFullYear() - dob.getFullYear()
  const dobStr = dob.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="overview-grid">
      {/* Personal info */}
      <Card style={{ padding: '0 20px' }}>
        <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '20px 0 0' }}>
          Personal Info
        </p>
        <InfoRow label="Date of Birth" value={`${dobStr} (Age ${age})`} />
        <InfoRow label="Nationality"   value={student.nationality}        />
        <InfoRow label="Team"          value={teamDisplayName}            />
        <InfoRow label="Academy"       value={student.academy}            />
        <InfoRow label="Position"      value={student.position}           />
        <InfoRow label="Enrolled"      value={new Date(student.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} />
        <div style={{ paddingBottom: 16 }} />
      </Card>

      {/* Parent contacts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card style={{ padding: 20 }}>
          <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 14px' }}>
            Parent / Guardian
          </p>
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>{student.parent_name}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href={`tel:${student.parent_phone}`} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13,
            }}>
              <IconPhone size={16} stroke={1.8} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              {student.parent_phone}
            </a>
            <a
              href={`https://wa.me/${student.parent_whatsapp}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                backgroundColor: '#25D366', color: '#fff',
                padding: '9px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
              }}
            >
              <IconBrandWhatsapp size={16} stroke={1.8} />
              Chat on WhatsApp
            </a>
          </div>
          {student.emergency_contact && (
            <>
              <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '16px 0 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 6px' }}>Emergency</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{student.emergency_contact}</p>
            </>
          )}
        </Card>
      </div>

      {/* Notes — full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
              <IconNotes size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Coach Notes (private)
            </p>
            <button onClick={saveNotes} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              backgroundColor: saved ? 'rgba(22,163,74,0.15)' : 'rgba(245,197,24,0.1)',
              color: saved ? '#16a34a' : '#f5c518',
              border: `1px solid ${saved ? 'rgba(22,163,74,0.3)' : 'rgba(245,197,24,0.3)'}`,
              borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}>
              {saved ? <IconCheck size={14} /> : <IconEdit size={14} />}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add private notes about this student…"
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', padding: 12,
              backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, outline: 'none',
              resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        </Card>
      </div>

      {/* Awards — full width */}
      {student.awards.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Card style={{ padding: 20 }}>
            <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 14px' }}>
              <IconAward size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Awards & Achievements
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {student.awards.map(a => (
                <span key={a} style={{
                  backgroundColor: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.25)',
                  color: '#f5c518', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                }}>
                  {a}
                </span>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function MedicalTab({ student, role }: { student: StudentRow; role: string }) {
  if (role === 'parent') {
    return (
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <IconShieldLock size={40} style={{ color: 'var(--border)', marginBottom: 16 }} />
        <h3 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Restricted Access</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
          Medical records are only accessible to coaches and administrators.
        </p>
      </Card>
    )
  }
  return (
    <Card style={{ padding: '0 20px' }}>
      <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '20px 0 0' }}>
        <IconMedicalCross size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />Medical Information
      </p>
      <InfoRow label="Blood Type"      value={student.blood_type}      />
      <InfoRow label="Allergies"       value={student.allergies}       />
      <InfoRow label="Injury History"  value={student.injuries}        />
      <InfoRow label="Doctor / Contact"value={student.doctor_contact}  />
      <InfoRow label="Insurance"       value={student.insured ? 'Insured' : 'No insurance'} />
      <div style={{ paddingBottom: 16 }} />
    </Card>
  )
}

function RatingsTab({ student }: { student: StudentRow }) {
  const baseKey = `mila_ratings_${student.id}`
  const [ratings, setRatings] = useState<RatingEntry[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(baseKey) ?? '[]') as RatingEntry[]
      return [...saved, ...generateRatings(student.id, student.overall_rating)]
    } catch {
      return generateRatings(student.id, student.overall_rating)
    }
  })
  const [showModal, setShowModal] = useState(false)

  const avgScore = (field: keyof Pick<RatingEntry, 'technique' | 'fitness' | 'attitude' | 'teamwork'>) =>
    ratings.length > 0
      ? parseFloat((ratings.reduce((s, r) => s + r[field], 0) / ratings.length).toFixed(1))
      : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Circular progress rings */}
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
            Average Scores
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              backgroundColor: '#16a34a', color: '#fff',
              border: 'none', borderRadius: 8, padding: '8px 16px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <IconPlus size={16} /> Add Rating
          </button>
        </div>
        <div className="metric-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
          <CircleRing label="Technique"  score={avgScore('technique')}  />
          <CircleRing label="Fitness"    score={avgScore('fitness')}    />
          <CircleRing label="Attitude"   score={avgScore('attitude')}   />
          <CircleRing label="Teamwork"   score={avgScore('teamwork')}   />
        </div>
      </Card>

      {/* History table */}
      <Card style={{ padding: '20px 24px' }}>
        <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 16px' }}>
          Rating History
        </p>
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr>
                {['Date', 'Coach', 'Tech', 'Fit', 'Att', 'TW', 'Overall', 'Notes'].map(h => (
                  <th key={h} style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', padding: '0 8px 10px', textAlign: 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ratings.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{r.date}</td>
                  <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13 }}>{r.coach}</td>
                  {(['technique', 'fitness', 'attitude', 'teamwork'] as const).map(f => (
                    <td key={f} style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>{r[f]}</td>
                  ))}
                  <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: '#f5c518', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>{r.overall}</td>
                  <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <AddRatingModal
          studentId={student.id}
          onClose={() => setShowModal(false)}
          onAdd={r => setRatings(p => [r, ...p])}
        />
      )}
    </div>
  )
}

function AttendanceTab({ student }: { student: StudentRow }) {
  const sessions = generateAttendance(student.id, student.attendance_rate)
  const present  = sessions.filter(s => s.status === 'present').length
  const late     = sessions.filter(s => s.status === 'late').length
  const absent   = sessions.filter(s => s.status === 'absent').length
  const rate     = Math.round(((present + late) / sessions.length) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats row */}
      <div className="metric-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Sessions', value: sessions.length, color: 'var(--text-primary)' },
          { label: 'Present',        value: present,         color: '#16a34a'              },
          { label: 'Absent',         value: absent,          color: '#ef4444'              },
          { label: 'Attendance Rate',value: `${rate}%`,      color: '#f5c518'              },
        ].map(({ label, value, color }) => (
          <Card key={label} style={{ padding: 16, textAlign: 'center' }}>
            <p style={{ color, fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>{value}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>{label}</p>
          </Card>
        ))}
      </div>

      {/* Session list — calendar-style grid */}
      <Card style={{ padding: 24 }}>
        <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 16px' }}>
          <IconActivity size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Session History
        </p>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>
          {Object.entries(STATUS_DOT).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: v.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v.label}</span>
            </div>
          ))}
        </div>

        {/* Dot grid — 5 columns (sessions per week) */}
        <div className="metric-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
          {sessions.map(({ date, status }) => {
            const dot = STATUS_DOT[status]
            const d   = new Date(date)
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <div key={date} title={`${label} — ${dot.label}`} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                backgroundColor: 'var(--bg-hover)', borderRadius: 8, padding: '10px 6px',
                border: '0.5px solid var(--border)',
              }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: dot.color }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 10, textAlign: 'center' }}>{label}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function PaymentsTab({ student }: { student: StudentRow }) {
  const storageKey = `mila_payments_${student.id}`
  const [payments, setPayments] = useState<PaymentEntry[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as PaymentEntry[]
      const base  = generatePayments(student.id, student.payment_status)
      return base.map(b => saved.find(s => s.id === b.id) ?? b)
    } catch {
      return generatePayments(student.id, student.payment_status)
    }
  })

  function markPaid(id: string) {
    const today = new Date().toISOString().split('T')[0]
    const updated = payments.map(p =>
      p.id === id ? { ...p, status: 'paid' as const, paid_date: today, method: 'cash' as const } : p
    )
    setPayments(updated)
    try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch {}
  }

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary */}
      <div className="metric-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Paid 2026',   value: `$${totalPaid}`,                   color: '#16a34a' },
          { label: 'Months Paid',       value: payments.filter(p=>p.status==='paid').length,   color: 'var(--text-primary)' },
          { label: 'Outstanding',       value: `$${payments.filter(p=>p.status!=='paid').reduce((s,p)=>s+(150-(p.status==='partial'?student.payment_amount:0)),0)}`, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <Card key={label} style={{ padding: 16, textAlign: 'center' }}>
            <p style={{ color, fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>{value}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>{label}</p>
          </Card>
        ))}
      </div>

      {/* Monthly table */}
      <Card style={{ padding: '20px 24px' }}>
        <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 16px' }}>
          <IconCreditCard size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Monthly History
        </p>
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr>
                {['Month', 'Amount', 'Status', 'Paid Date', 'Method', ''].map(h => (
                  <th key={h} style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', padding: '0 0 10px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const s = PAY_STYLE[p.status]
                return (
                  <tr key={p.id}>
                    <td style={{ padding: '11px 0', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13 }}>{p.month}</td>
                    <td style={{ padding: '11px 0', borderTop: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>${p.amount}</td>
                    <td style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                      <Badge label={s.label} bg={s.bg} color={s.color} />
                    </td>
                    <td style={{ padding: '11px 0', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>{p.paid_date || '—'}</td>
                    <td style={{ padding: '11px 0', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, textTransform: 'capitalize' }}>{p.method || '—'}</td>
                    <td style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                      {p.status !== 'paid' && (
                        <button onClick={() => markPaid(p.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          backgroundColor: 'rgba(22,163,74,0.15)', color: '#16a34a',
                          border: '1px solid rgba(22,163,74,0.3)', borderRadius: 8,
                          padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>
                          <IconCheck size={13} /> Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

const ALL_TABS = [
  { key: 'overview',   label: 'Overview',   Icon: IconNotes       },
  { key: 'medical',    label: 'Medical',    Icon: IconMedicalCross },
  { key: 'ratings',    label: 'Ratings',    Icon: IconStarFilled  },
  { key: 'attendance', label: 'Attendance', Icon: IconActivity    },
  { key: 'payments',   label: 'Payments',   Icon: IconCreditCard  },
] as const

type Tab = typeof ALL_TABS[number]['key']

export default function StudentDetailPage() {
  const router  = useRouter()
  const params  = useParams<{ id: string }>()
  const [student, setStudent] = useState<StudentRow | null>(null)
  const [teams,   setTeams]   = useState<TeamRow[]>([])
  const [tab, setTab] = useState<Tab>('overview')

  // `loading` is derived from which id we have finished fetching, rather than a
  // separate flag flipped at the top of the effect (a setState-in-effect).
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const loading = loadedId !== params.id

  // Read via the session store, not getCurrentUser() during render: that hit
  // localStorage on every render and returned null on the server, so the tab
  // list hydrated differently than it rendered.
  const { user: authUser, ready } = useSession()
  // Fall back to the LEAST privileged role, not 'admin' - with the old default
  // the Payments tab rendered for a split second before the session resolved.
  const role = authUser?.role ?? 'student'

  const TABS = ALL_TABS.filter(t =>
    t.key !== 'payments' || (role !== 'coach' && role !== 'student')
  )

  useEffect(() => {
    if (!ready) return
    if (!authUser) { router.replace('/dashboard/login'); return }
    if ((authUser.role === 'parent' || authUser.role === 'student') && params.id !== String(authUser.studentId)) {
      router.replace(`/dashboard/students/${authUser.studentId ?? ''}`)
    }
  }, [ready, authUser, params.id, router])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchStudent(params.id), fetchTeams()])
      .then(([s, t]) => { if (!cancelled) { setStudent(s); setTeams(t) } })
      .catch(() => { if (!cancelled) setStudent(null) })
      .finally(() => { if (!cancelled) setLoadedId(params.id) })
    return () => { cancelled = true }
  }, [params.id])

  if (loading || !ready) return null

  if (!student) {
    return (
      <div style={{ color: 'var(--text-primary)', textAlign: 'center', paddingTop: 60 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>Student not found.</p>
        <button onClick={() => router.push('/dashboard/students')} style={{ background: 'none', border: 'none', color: '#f5c518', cursor: 'pointer', fontSize: 14 }}>
          ← Back to Students
        </button>
      </div>
    )
  }

  const teamDisplayName = teams.find(t => t.id === student.team_id)?.name ?? '—'

  async function removeStudent(url: string, init: RequestInit, done: string) {
    const res = await fetch(url, init)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      window.alert(body?.error ?? `Request failed (${res.status})`)
      return
    }
    window.alert(done)
    router.push('/dashboard/students')
  }

  function archiveStudent() {
    if (!window.confirm(`Archive ${student!.name}? They are hidden from the lists but nothing is deleted, and their login keeps working.`)) return
    void removeStudent(`/api/admin/students/${student!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived_at: new Date().toISOString() }),
    }, 'Student archived.')
  }

  function deleteStudent() {
    if (!window.confirm(`Permanently delete ${student!.name}, including any parent/student login linked to them? This cannot be undone.`)) return
    void removeStudent(`/api/admin/students/${student!.id}`, { method: 'DELETE' }, 'Student deleted.')
  }

  const acad  = ACAD_STYLE[student.academy]
  const inits = student.name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        .tab-btn { display: flex; align-items: center; gap: 7px; padding: 9px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; }
        .tab-btn.active { background: rgba(245,197,24,0.15); color: #f5c518; }
        .tab-btn.inactive { background: none; color: var(--text-muted); }
        .tab-btn.inactive:hover { background: var(--bg-hover); color: var(--text-secondary); }
        .overview-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
        @media (max-width: 700px) { .overview-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard/students')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, marginBottom: 24, padding: 0 }}
      >
        <IconArrowLeft size={18} stroke={1.8} /> Back to Students
      </button>

      {/* Hero */}
      <Card style={{ padding: 'clamp(18px, 5vw, 28px)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
            backgroundColor: student.academy === 'MFA' ? 'rgba(22,163,74,0.2)' : 'rgba(249,115,22,0.2)',
            border: `3px solid ${student.academy === 'MFA' ? 'rgba(22,163,74,0.5)' : 'rgba(249,115,22,0.5)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: student.academy === 'MFA' ? '#16a34a' : '#f97316',
            fontWeight: 800, fontSize: 26,
          }}>
            {inits}
          </div>

          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ color: 'var(--text-primary)', fontSize: 'clamp(21px, 6vw, 28px)', fontWeight: 700, margin: '0 0 10px' }}>
              {student.name}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{
                backgroundColor: 'var(--bg-hover)', border: '0.5px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700,
                padding: '4px 10px', borderRadius: 6,
              }}>
                #{student.jersey_number}
              </span>
              <Badge label={student.position}   bg="var(--bg-hover)" color="var(--text-secondary)" size={12} />
              <Badge label={student.academy}    bg={acad.bg}         color={acad.color} size={12} />
              <Badge label={teamDisplayName} bg="rgba(255,255,255,0.06)" color="var(--text-secondary)" size={12} />
              <Stars rating={student.overall_rating} />
            </div>
          </div>

          {/* Attendance stat */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <p style={{ color: '#f5c518', fontSize: 28, fontWeight: 800, margin: 0 }}>{student.attendance_rate}%</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>Attendance</p>
          </div>

          {role === 'admin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              <button onClick={archiveStudent} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
              }}>
                Archive
              </button>
              <button onClick={deleteStudent} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)',
              }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="scroll-row" style={{ display: 'flex', gap: 4, marginBottom: 20, paddingBottom: 2 }}>
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`tab-btn ${tab === key ? 'active' : 'inactive'}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab body */}
      {tab === 'overview'   && <OverviewTab   key={student.id} student={student} teamDisplayName={teamDisplayName} />}
      {tab === 'medical'    && <MedicalTab    key={student.id} student={student} role={role} />}
      {tab === 'ratings'    && <RatingsTab    key={student.id} student={student} />}
      {tab === 'attendance' && <AttendanceTab key={student.id} student={student} />}
      {tab === 'payments'   && <PaymentsTab   key={student.id} student={student} />}
    </div>
  )
}
