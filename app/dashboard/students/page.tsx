'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconSearch, IconPlus, IconX, IconUsers,
  IconStarFilled, IconStar, IconArchive, IconArchiveOff, IconTrash,
} from '@tabler/icons-react'
import type { StudentRow } from './data'
import { getCurrentUser } from '@/lib/auth'
import { useSelectedAcademy } from '@/lib/use-session'
import { fetchStudents, fetchTeams, createStudent, archiveStudent, deleteStudent, type TeamRow } from './api'
import { useModal, modalOverlayProps } from '../hooks/useModal'
import { confirmAction } from '../components/admin-ui'
import { toast } from '../components/toast'

// ── Constants ──────────────────────────────────────────────────────────────────

const PAYMENT_STYLE = {
  paid:    { bg: 'rgba(22,163,74,0.15)',  color: '#16a34a', label: 'Paid'    },
  unpaid:  { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Unpaid'  },
  partial: { bg: 'rgba(245,197,24,0.15)',color: '#f5c518', label: 'Partial' },
}

const ACADEMY_STYLE = {
  MFA: { bg: 'rgba(22,163,74,0.15)',  color: '#16a34a' },
  MBA: { bg: 'rgba(249,115,22,0.15)', color: '#f97316' },
}

const CARD_ACTION: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
  cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--text-primary)',
  border: '1px solid var(--border)', minHeight: 32,
}

// ── Mini components ────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  const full  = Math.floor(rating)
  const hasHalf = rating % 1 >= 0.3
  const empty = 5 - full - (hasHalf ? 1 : 0)
  return (
    <span style={{ display: 'flex', gap: 1 }}>
      {Array.from({ length: full }).map((_, i) =>
        <IconStarFilled key={`f${i}`} size={12} style={{ color: '#f5c518' }} />
      )}
      {hasHalf && <IconStarFilled size={12} style={{ color: '#f5c518', opacity: 0.45 }} />}
      {Array.from({ length: empty }).map((_, i) =>
        <IconStar key={`e${i}`} size={12} style={{ color: 'var(--text-muted)' }} />
      )}
    </span>
  )
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      backgroundColor: bg, color,
    }}>
      {label}
    </span>
  )
}

function initials(name: string) {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

// ── Student card ───────────────────────────────────────────────────────────────

function StudentCard({
  student, teams, onClick, canArchive, canDelete, onArchive, onDelete, busy,
}: {
  student: StudentRow
  teams: TeamRow[]
  onClick: () => void
  canArchive: boolean
  canDelete: boolean
  onArchive: (s: StudentRow) => void
  onDelete: (s: StudentRow) => void
  busy: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const acad  = ACADEMY_STYLE[student.academy]
  const pmnt  = PAYMENT_STYLE[student.payment_status]
  const team  = teams.find(t => t.id === student.team_id)?.name ?? '—'
  const archived = !!student.archived_at

  // A div rather than a button: the card now holds its own action buttons,
  // and a button cannot legally contain another button.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0,
        cursor: 'pointer',
      }}
    >
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: `0.5px solid ${hovered ? '#f5c518' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '20px 20px 16px',
        transition: 'border-color 0.2s ease, transform 0.15s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        opacity: archived ? 0.6 : 1,
      }}>
        {/* Top row: avatar + badges */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          {/* Avatar */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            backgroundColor: student.academy === 'MFA' ? 'rgba(22,163,74,0.2)' : 'rgba(249,115,22,0.2)',
            border: `2px solid ${student.academy === 'MFA' ? 'rgba(22,163,74,0.4)' : 'rgba(249,115,22,0.4)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: student.academy === 'MFA' ? '#16a34a' : '#f97316',
            fontWeight: 800, fontSize: 16,
          }}>
            {initials(student.name)}
          </div>
          {/* Jersey + academy */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <span style={{
              backgroundColor: 'var(--bg)', border: '0.5px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700,
              padding: '2px 8px', borderRadius: 6,
            }}>
              #{student.jersey_number}
            </span>
            <Badge label={student.academy} bg={acad.bg} color={acad.color} />
          </div>
        </div>

        {/* Name + position */}
        <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 3px' }}>
          {student.name}
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '0 0 12px' }}>
          {student.position} · {team}
        </p>

        {/* Bottom row: payment + attendance + stars */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge label={pmnt.label} bg={pmnt.bg} color={pmnt.color} />
            {archived && <Badge label="Archived" bg="rgba(136,136,136,0.18)" color="#9ca3af" />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <Stars rating={student.overall_rating} />
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {student.attendance_rate}% attendance
            </span>
          </div>
        </div>

        {(canArchive || canDelete) && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}
          >
            {canArchive && (
              <button
                onClick={() => onArchive(student)}
                disabled={busy}
                title={archived ? 'Put this student back on the active list' : 'Hide from the active list, keeping the record'}
                style={{ ...CARD_ACTION, opacity: busy ? 0.5 : 1 }}
              >
                {archived ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
                {archived ? 'Restore' : 'Archive'}
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(student)}
                disabled={busy}
                title="Permanently delete this student and their records"
                style={{
                  ...CARD_ACTION,
                  backgroundColor: 'rgba(220,38,38,0.12)', color: '#f87171',
                  border: '1px solid rgba(220,38,38,0.3)', opacity: busy ? 0.5 : 1,
                }}
              >
                <IconTrash size={14} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add Student Modal ──────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', dob: '', nationality: 'Lebanese', position: '', jersey_number: '',
  team_id: '', academy: 'MFA' as 'MFA' | 'MBA',
  parent_name: '', parent_phone: '', parent_whatsapp: '', emergency_contact: '',
  blood_type: '', allergies: '', injuries: '', doctor_contact: '', insured: 'no',
  payment_status: 'paid' as 'paid' | 'unpaid' | 'partial', payment_amount: '150',
  notes: '',
  create_login: false, login_email: '', login_role: 'parent' as 'parent' | 'student',
}

function Field({
  label, value, onChange, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; children?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  const lifted = focused || value.length > 0
  return (
    <div style={{ position: 'relative' }}>
      <label style={{
        position: 'absolute', left: 12, top: '50%',
        transform: lifted ? 'translateY(-165%)' : 'translateY(-50%)',
        fontSize: lifted ? 10 : 13, color: lifted ? '#f5c518' : 'var(--text-muted)',
        backgroundColor: 'var(--bg-card)', padding: lifted ? '0 4px' : '0',
        transition: 'all 0.15s ease', pointerEvents: 'none', zIndex: 1, lineHeight: 1,
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '14px 12px', boxSizing: 'border-box',
          backgroundColor: 'var(--bg-card)', border: `1px solid ${focused ? '#f5c518' : 'var(--border)'}`,
          borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
          fontFamily: 'inherit', transition: 'border-color 0.15s ease',
        }}
      />
    </div>
  )
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <label style={{
        position: 'absolute', left: 12, top: 0,
        transform: 'translateY(-50%)', fontSize: 10, color: '#f5c518',
        backgroundColor: 'var(--bg-card)', padding: '0 4px', zIndex: 1, lineHeight: 1,
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '14px 12px', boxSizing: 'border-box',
          backgroundColor: 'var(--bg-card)', border: `1px solid ${focused ? '#f5c518' : 'var(--border)'}`,
          borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
          appearance: 'none', cursor: 'pointer',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 010 1.659l-4.796 5.48a1 1 0 01-1.506 0z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '11px',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function AddStudentModal({
  teams,
  onClose,
  onAdd,
}: {
  teams: TeamRow[]
  onClose: () => void
  onAdd: (s: StudentRow) => void
}) {
  const [form, setForm]     = useState(() => ({ ...EMPTY_FORM, team_id: teams[0]?.id ?? '' }))
  const [section, setSection] = useState<'basic' | 'parent' | 'medical' | 'payment' | 'login'>('basic')
  const [created, setCreated] = useState<{ student: StudentRow; login?: { email: string; password: string } } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await createStudent({
        name: form.name,
        dob: form.dob || null,
        nationality: form.nationality,
        position: form.position,
        jersey_number: parseInt(form.jersey_number) || null,
        team_id: form.team_id || null,
        academy: teams.find(t => t.id === form.team_id)?.academy ?? form.academy,
        blood_type: form.blood_type || '',
        allergies: form.allergies || 'None',
        injuries: form.injuries || 'None',
        doctor_contact: form.doctor_contact,
        insured: form.insured === 'yes',
        parent_name: form.parent_name,
        parent_phone: form.parent_phone,
        parent_whatsapp: form.parent_whatsapp,
        emergency_contact: form.emergency_contact,
        payment_status: form.payment_status,
        payment_amount: parseFloat(form.payment_amount) || 0,
        payment_due_date: new Date().toISOString().split('T')[0],
        notes: form.notes,
        account: form.create_login ? { email: form.login_email, role: form.login_role } : undefined,
      })
      onAdd(result.student)
      if (result.login) setCreated(result)
      else onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add student.')
    } finally {
      setSaving(false)
    }
  }

  const SECTIONS = [
    { key: 'basic' as const,   label: 'Basic Info'   },
    { key: 'parent' as const,  label: 'Parent Info'  },
    { key: 'medical' as const, label: 'Medical'      },
    { key: 'payment' as const, label: 'Payment'      },
    { key: 'login' as const,   label: 'Login'        },
  ]

  useModal(onClose)

  return (
    <div {...modalOverlayProps} aria-label="Add student" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)',
        borderRadius: 16, width: '100%', maxWidth: 520,
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: 0 }}>Add New Student</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={20} />
          </button>
        </div>

        {created?.login ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              {created.student.name} was added. Send these sign-in details to the {form.login_role}. The password is shown <strong>only once</strong>; they choose their own on first sign-in and it stays private after that.
            </p>
            <div style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontFamily: 'var(--font-geist-mono), monospace', fontSize: 14, lineHeight: 1.8 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Sign in at: </span>{typeof window !== 'undefined' ? `${window.location.origin}/dashboard/login` : '/dashboard/login'}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Email: </span>{created.login.email}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Password: </span><span style={{ color: '#f5c518', fontWeight: 700, userSelect: 'all' }}>{created.login.password}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => navigator.clipboard?.writeText(`Email: ${created.login!.email}\nTemporary password: ${created.login!.password}`)} style={{
                flex: 1, height: 44, borderRadius: 8, border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>Copy</button>
              <button type="button" onClick={onClose} style={{
                flex: 1, height: 44, borderRadius: 8, border: 'none',
                backgroundColor: '#f5c518', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>Done</button>
            </div>
          </div>
        ) : <>
        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '16px 24px 0' }}>
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              style={{
                flex: 1, padding: '7px 4px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                backgroundColor: section === s.key ? 'rgba(245,197,24,0.15)' : 'var(--bg-card)',
                color: section === s.key ? '#f5c518' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {section === 'basic' && <>
              <Field label="Full Name *"      value={form.name}         onChange={set('name')}         />
              <Field label="Date of Birth *"  value={form.dob}          onChange={set('dob')}  type="date" />
              <Field label="Nationality"      value={form.nationality}  onChange={set('nationality')}  />
              <Field label="Position *"       value={form.position}     onChange={set('position')}     />
              <Field label="Jersey Number"    value={form.jersey_number}onChange={set('jersey_number')}type="number" />
              <SelectField
                label="Team *"
                value={form.team_id}
                onChange={v => {
                  const acad = teams.find(t => t.id === v)?.academy ?? 'MFA'
                  setForm(p => ({ ...p, team_id: v, academy: acad }))
                }}
                options={teams.map(t => ({ value: t.id, label: t.name }))}
              />
            </>}

            {section === 'parent' && <>
              <Field label="Parent / Guardian Name *" value={form.parent_name}       onChange={set('parent_name')}       />
              <Field label="Phone"                    value={form.parent_phone}      onChange={set('parent_phone')}  type="tel" />
              <Field label="WhatsApp (e.g. 96170...)" value={form.parent_whatsapp}  onChange={set('parent_whatsapp')}   />
              <Field label="Emergency Contact"        value={form.emergency_contact} onChange={set('emergency_contact')} />
            </>}

            {section === 'medical' && <>
              <SelectField
                label="Blood Type"
                value={form.blood_type}
                onChange={set('blood_type')}
                options={['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'].map(v => ({ value: v, label: v }))}
              />
              <Field label="Allergies"         value={form.allergies}      onChange={set('allergies')}      />
              <Field label="Injury History"    value={form.injuries}       onChange={set('injuries')}       />
              <Field label="Doctor / Contact"  value={form.doctor_contact} onChange={set('doctor_contact')} />
              <SelectField
                label="Insurance"
                value={form.insured}
                onChange={set('insured')}
                options={[{ value: 'no', label: 'No insurance' }, { value: 'yes', label: 'Insured' }]}
              />
            </>}

            {section === 'payment' && <>
              <SelectField
                label="Payment Status"
                value={form.payment_status}
                onChange={set('payment_status') as (v: string) => void}
                options={[
                  { value: 'paid', label: 'Paid' },
                  { value: 'unpaid', label: 'Unpaid' },
                  { value: 'partial', label: 'Partial' },
                ]}
              />
              <Field label="Amount Paid ($)" value={form.payment_amount} onChange={set('payment_amount')} type="number" />
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 6 }}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%', padding: 12, boxSizing: 'border-box',
                    backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>
            </>}

            {section === 'login' && <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.create_login} onChange={e => setForm(p => ({ ...p, create_login: e.target.checked }))} />
                Create a sign-in for this student
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                A temporary password is generated and shown once. They must change it on first sign-in, after which only they know it.
              </p>
              {form.create_login && <>
                <SelectField label="Account for" value={form.login_role} onChange={v => setForm(p => ({ ...p, login_role: v as 'parent' | 'student' }))}
                  options={[{ value: 'parent', label: 'Parent / guardian' }, { value: 'student', label: 'The student' }]} />
                <Field label="Login email *" value={form.login_email} onChange={set('login_email')} type="email" />
              </>}
            </>}
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: 13, marginTop: 14, textAlign: 'center' }}>{error}</p>
          )}

          {/* Footer buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, height: 44, borderRadius: 8, border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Cancel
            </button>
            {section !== 'login' ? (
              <button type="button" onClick={() => {
                const order = ['basic', 'parent', 'medical', 'payment', 'login'] as const
                const next = order[order.indexOf(section) + 1]
                if (next) setSection(next)
              }} style={{
                flex: 1, height: 44, borderRadius: 8, border: 'none',
                backgroundColor: '#f5c518', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                Next →
              </button>
            ) : (
              <button type="submit" disabled={saving || !form.name || !form.dob || !form.position || (form.create_login && !form.login_email.trim())} style={{
                flex: 1, height: 44, borderRadius: 8, border: 'none',
                backgroundColor: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                opacity: saving || !form.name || !form.dob || !form.position || (form.create_login && !form.login_email.trim()) ? 0.5 : 1,
              }}>
                {saving ? 'Adding…' : 'Add Student'}
              </button>
            )}
          </div>
        </form>
        </>}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const router  = useRouter()

  // Parent/student should only see their own profile
  useEffect(() => {
    const u = getCurrentUser()
    if (!u) { router.replace('/dashboard/login'); return }
    if (u.role === 'parent' || u.role === 'student') {
      router.replace(`/dashboard/students/${u.studentId ?? ''}`)
    }
  }, [router])

  const [allStudents, setAllStudents]   = useState<StudentRow[]>([])
  const [teams,        setTeams]        = useState<TeamRow[]>([])
  const [loading,       setLoading]     = useState(true)
  const [loadError,     setLoadError]   = useState('')
  // Archived students are left out of the list by default; the toggle asks the
  // API for them so they can be restored or deleted for good.
  const [showArchived, setShowArchived] = useState(false)
  const [version,       setVersion]     = useState(0)
  const [busyId,        setBusyId]      = useState('')
  const role = getCurrentUser()?.role
  const canArchive = role === 'admin' || role === 'coach'
  const canDelete  = role === 'admin'
  const selectedAcademy = useSelectedAcademy()
  const [search,   setSearch]           = useState('')
  // Follows the sidebar switcher unless overridden by the filter below. Seeding
  // this from localStorage in the initialiser ran on the server too, so the
  // prerendered markup always showed 'All'.
  const [academyOverride, setAcademy] = useState<'All' | 'MFA' | 'MBA' | null>(null)
  const academy: 'All' | 'MFA' | 'MBA' =
    academyOverride ?? (selectedAcademy === 'Both' ? 'All' : selectedAcademy)
  const [team,     setTeam]             = useState('All')
  const [payment,  setPayment]          = useState<'All' | 'paid' | 'unpaid' | 'partial'>('All')
  const [showModal, setShowModal]       = useState(false)
  const isAdmin = getCurrentUser()?.role === 'admin'

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchStudents(showArchived), fetchTeams()])
      .then(([s, t]) => {
        if (cancelled) return
        const u = getCurrentUser()
        let visible = s
        if (u?.role === 'coach') {
          visible = u.teamId ? s.filter(x => x.team_id === u.teamId) : s.filter(x => u.academies.includes(x.academy))
        }
        setAllStudents(visible)
        setTeams(t)
        setLoadError('')
      })
      .catch(err => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load students.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [showArchived, version])

  async function onArchive(s: StudentRow) {
    const archived = !!s.archived_at
    if (!archived && !confirmAction(`Archive ${s.name}? They drop off the active list but the record is kept, and you can restore them any time.`)) return
    setBusyId(s.id)
    try {
      await archiveStudent(s.id, !archived)
      setVersion(v => v + 1)
      toast(archived ? `${s.name} restored` : `${s.name} archived`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update student')
    } finally {
      setBusyId('')
    }
  }

  async function onDelete(s: StudentRow) {
    if (!confirmAction(`Permanently delete ${s.name}? This also removes their attendance, ratings, payments and documents, and cannot be undone. Archive instead if you only want them off the list.`)) return
    setBusyId(s.id)
    try {
      await deleteStudent(s.id)
      setVersion(v => v + 1)
      toast(`${s.name} deleted`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete student')
    } finally {
      setBusyId('')
    }
  }

  // Switching academy in the sidebar clears any local override.
  useEffect(() => {
    function onAcademyChange() { setAcademy(null) }
    window.addEventListener('mila_academy_changed', onAcademyChange)
    return () => window.removeEventListener('mila_academy_changed', onAcademyChange)
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allStudents.filter(s => {
      if (q && !s.name.toLowerCase().includes(q) && !s.position.toLowerCase().includes(q)) return false
      if (academy !== 'All' && s.academy !== academy) return false
      if (team !== 'All' && s.team_id !== team) return false
      if (payment !== 'All' && s.payment_status !== payment) return false
      return true
    })
  }, [allStudents, search, academy, team, payment])

  const filterSelect: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8,
    color: 'var(--text-secondary)', fontSize: 13, padding: '9px 32px 9px 12px', outline: 'none',
    appearance: 'none', cursor: 'pointer',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 010 1.659l-4.796 5.48a1 1 0 01-1.506 0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '11px',
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <style>{`
        .students-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 24px;
        }
        @media (max-width: 900px) { .students-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .students-grid { grid-template-columns: minmax(0, 1fr); } }
        .filter-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 20px; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Students</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
            {loading ? 'Loading…' : `${filtered.length} of ${allStudents.length} students`}
          </p>
        </div>
        {isAdmin && <button
          onClick={() => setShowModal(true)}
          disabled={teams.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: '#16a34a', color: '#fff',
            border: 'none', borderRadius: 10, padding: '10px 18px',
            fontSize: 14, fontWeight: 600, cursor: teams.length === 0 ? 'default' : 'pointer',
            opacity: teams.length === 0 ? 0.5 : 1,
            transition: 'background-color 0.2s ease',
          }}
        >
          <IconPlus size={18} stroke={2} />
          Add Student
        </button>}
      </div>

      {loadError && (
        <p style={{ color: '#ef4444', fontSize: 13, marginTop: 12 }}>{loadError}</p>
      )}

      {/* Filter bar */}
      <div className="filter-bar">
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <IconSearch size={15} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)',
          }} />
          <input
            type="text"
            placeholder="Search by name or position…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px 9px 36px',
              backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
            }}>
              <IconX size={14} />
            </button>
          )}
        </div>

        <select value={academy} onChange={e => setAcademy(e.target.value as typeof academy)} style={filterSelect}>
          <option value="All">All Academies</option>
          <option value="MFA">MFA</option>
          <option value="MBA">MBA</option>
        </select>

        <select value={team} onChange={e => setTeam(e.target.value)} style={filterSelect}>
          <option value="All">All Teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select value={payment} onChange={e => setPayment(e.target.value as typeof payment)} style={filterSelect}>
          <option value="All">All Payments</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
        </select>

        {canArchive && (
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13, padding: '9px 12px',
            backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8,
          }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: '#f5c518', cursor: 'pointer' }}
            />
            Show archived
          </label>
        )}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="students-grid">
          {filtered.map(s => (
            <StudentCard
              key={s.id}
              student={s}
              teams={teams}
              onClick={() => router.push(`/dashboard/students/${s.id}`)}
              canArchive={canArchive}
              canDelete={canDelete}
              onArchive={onArchive}
              onDelete={onDelete}
              busy={busyId === s.id}
            />
          ))}
        </div>
      ) : !loading && (
        <div style={{
          marginTop: 60, textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <IconUsers size={40} style={{ color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 15, margin: 0 }}>No students match your filters.</p>
          <button
            onClick={() => { setSearch(''); setAcademy('All'); setTeam('All'); setPayment('All') }}
            style={{ background: 'none', border: 'none', color: '#f5c518', fontSize: 13, cursor: 'pointer' }}
          >
            Clear filters
          </button>
        </div>
      )}

      {showModal && (
        <AddStudentModal
          teams={teams}
          onClose={() => setShowModal(false)}
          onAdd={s => setAllStudents(p => [...p, s])}
        />
      )}
    </div>
  )
}
