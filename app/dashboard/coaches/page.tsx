'use client'

import { useState, useMemo } from 'react'
import { IconPlus, IconX, IconPencil, IconTrash } from '@tabler/icons-react'
import { toast } from '../components/toast'
import { useRequireAccess } from '../hooks/useRequireAccess'
import { useModal, modalOverlayProps } from '../hooks/useModal'
import { useSelectedAcademy } from '@/lib/use-session'
import { useAdminData, confirmAction } from '../components/admin-ui'
import type { TeamRow } from '../students/api'
import { useCoaches, createCoach, createLoginForCoach, updateCoach, deleteCoach, type CoachRow, type CoachInput, type NewLogin } from './data'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SessionRecord {
  id: string; date: string; team_id: string; team_name: string
  coach: string; records: Record<string, string>
  student_names: Record<string, string>; saved_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(n: string) { return n.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) }
function expColor(y: number) { return y >= 7 ? '#f5c518' : y >= 4 ? '#16a34a' : '#3b82f6' }

/** Team name / academy colour by id, from the teams actually in the database. */
function useTeamLookup(teams: TeamRow[]) {
  return useMemo(() => {
    const byId = new Map(teams.map(t => [t.id, t]))
    return {
      name:    (id: string) => byId.get(id)?.name ?? 'Unknown team',
      academy: (id: string) => byId.get(id)?.academy,
      color:   (id: string) => (byId.get(id)?.academy === 'MBA' ? '#f97316' : '#16a34a'),
    }
  }, [teams])
}

type Lookup = ReturnType<typeof useTeamLookup>

const FIELD: React.CSSProperties = {
  width: '100%', backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8,
  color: 'var(--text-secondary)', fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
}
const LBL: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 5 }

// ── Sign-in details (shown once) ──────────────────────────────────────────────

function LoginDetailsModal({ name, login, onClose }: { name: string; login: NewLogin; onClose: () => void }) {
  useModal(onClose)
  const text = `Email: ${login.email}
Temporary password: ${login.password}`
  return (
    <div {...modalOverlayProps} aria-label="Sign-in details" style={{ position: 'fixed', inset: 0, zIndex: 2100, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 460, padding: 'clamp(18px, 5vw, 28px)' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>{name} can now sign in</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
          Send these details to the coach. The password is shown <strong>only once</strong>; they choose their own when they first sign in, and after that only they know it.
        </p>
        <div style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontFamily: 'var(--font-geist-mono), monospace', fontSize: 14, lineHeight: 1.8, wordBreak: 'break-all' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Sign in at: </span>{typeof window !== 'undefined' ? `${window.location.origin}/dashboard/login` : '/dashboard/login'}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Email: </span>{login.email}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Password: </span><span style={{ color: '#f5c518', fontWeight: 700, userSelect: 'all' }}>{login.password}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={() => { void navigator.clipboard?.writeText(text).then(() => toast('Copied')) }} style={{ flex: 1, padding: '11px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Copy</button>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', backgroundColor: '#f5c518', color: '#000', border: 'none' }}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Add / Edit Coach Modal ────────────────────────────────────────────────────

/** `date` columns reject an empty string, so blank dates have to go as null. */
const dateOrNull = (v: string) => (v.trim() === '' ? null : v)

function CoachFormModal({
  coach, teams, lookup, userRole, onDone, onClose,
}: {
  coach: CoachRow | null
  teams: TeamRow[]
  lookup: Lookup
  userRole: string
  onDone: (verb: string, name: string, login?: NewLogin) => void
  onClose: () => void
}) {
  const editing = coach !== null
  const [form, setForm] = useState({
    name: coach?.name ?? '',
    specialty: coach?.specialty ?? '',
    experience: String(coach?.experience ?? 1),
    bio: coach?.bio ?? '',
    phone: coach?.phone ?? '',
    email: coach?.email ?? '',
    nationality: coach?.nationality ?? 'Lebanese',
    certifications: (coach?.certifications ?? []).join(', '),
    languages: (coach?.languages ?? ['Arabic']).join(', '),
    joined: coach?.joined ?? new Date().toISOString().split('T')[0],
    salary: coach?.salary ?? '',
    contract_end: coach?.contract_end ?? '',
    team_ids: coach?.team_ids ?? ([] as string[]),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const toggleTeam = (id: string) => setForm(p => ({
    ...p,
    team_ids: p.team_ids.includes(id) ? p.team_ids.filter(t => t !== id) : [...p.team_ids, id],
  }))

  async function save() {
    const name = form.name.trim()
    if (!name) { setError('Full name is required.'); return }
    if (!editing && !/^[^s@]+@[^s@]+.[^s@]+$/.test(form.email.trim())) { setError('A valid email is required: it is the coach’s sign-in.'); return }

    const values: CoachInput = {
      name,
      session_name: `Coach ${name.split(' ').pop() ?? name}`,
      specialty: form.specialty,
      team_ids: form.team_ids,
      experience: Number(form.experience) || 0,
      bio: form.bio,
      phone: form.phone,
      email: form.email,
      nationality: form.nationality,
      certifications: form.certifications.split(',').map(s => s.trim()).filter(Boolean),
      languages: form.languages.split(',').map(s => s.trim()).filter(Boolean),
      joined: dateOrNull(form.joined),
    }
    // Salary and contract dates are admin-only fields; a coach editing a
    // profile must not be able to blank them out by submitting the form.
    if (userRole === 'admin') {
      values.salary = form.salary
      values.contract_end = dateOrNull(form.contract_end)
    }

    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateCoach(coach.id, values)
        onDone('updated', name)
      } else {
        const { login } = await createCoach(values)
        onDone('added', name, login)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  useModal(onClose)

  return (
    <div {...modalOverlayProps} aria-label={editing ? 'Edit coach' : 'Add coach'} style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90dvh', overflowY: 'auto', padding: 'clamp(18px, 5vw, 28px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: 0 }}>{editing ? 'Edit Coach' : 'Add Coach'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={20} /></button>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div><label style={LBL}>FULL NAME *</label><input style={FIELD} value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div><label style={LBL}>SPECIALTY</label><input style={FIELD} value={form.specialty} onChange={e => set('specialty', e.target.value)} placeholder="e.g. Attack & Finishing" /></div>
          </div>
          <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div><label style={LBL}>YEARS EXPERIENCE</label><input type="number" min="0" max="40" style={FIELD} value={form.experience} onChange={e => set('experience', e.target.value)} /></div>
            <div><label style={LBL}>NATIONALITY</label><input style={FIELD} value={form.nationality} onChange={e => set('nationality', e.target.value)} /></div>
          </div>

          <div>
            <label style={LBL}>ASSIGNED TEAMS</label>
            {teams.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>No teams yet — create one under Teams first.</p>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {teams.map(t => {
                  const on = form.team_ids.includes(t.id)
                  return (
                    <button key={t.id} onClick={() => toggleTeam(t.id)} style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: `1.5px solid ${on ? lookup.color(t.id) : 'var(--border)'}`,
                      backgroundColor: on ? `${lookup.color(t.id)}22` : 'var(--bg)',
                      color: on ? lookup.color(t.id) : 'var(--text-muted)',
                    }}>{t.name}</button>
                  )
                })}
              </div>
            )}
          </div>

          <div><label style={LBL}>BIO</label><textarea rows={3} style={{ ...FIELD, resize: 'vertical' }} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Brief coach biography…" /></div>
          <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div><label style={LBL}>PHONE</label><input style={FIELD} value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div>
              <label style={LBL}>{editing ? 'EMAIL' : 'EMAIL * (THEIR SIGN-IN)'}</label>
              <input type="email" style={FIELD} value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div><label style={LBL}>CERTIFICATIONS (comma-separated)</label><input style={FIELD} value={form.certifications} onChange={e => set('certifications', e.target.value)} placeholder="UEFA B License, FIFA Grassroots…" /></div>
          <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div><label style={LBL}>LANGUAGES (comma-separated)</label><input style={FIELD} value={form.languages} onChange={e => set('languages', e.target.value)} /></div>
            <div><label style={LBL}>DATE JOINED</label><input type="date" style={{ ...FIELD, colorScheme: 'dark' }} value={form.joined ?? ''} onChange={e => set('joined', e.target.value)} /></div>
          </div>

          {userRole === 'admin' && (
            <div style={{ padding: '14px', backgroundColor: 'rgba(245,197,24,0.05)', border: '0.5px solid rgba(245,197,24,0.15)', borderRadius: 10 }}>
              <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, margin: '0 0 12px', letterSpacing: '0.5px' }}>🔒 ADMIN ONLY</p>
              <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                <div><label style={LBL}>SALARY</label><input style={FIELD} value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="e.g. $1,200/month" /></div>
                <div><label style={LBL}>CONTRACT END</label><input type="date" style={{ ...FIELD, colorScheme: 'dark' }} value={form.contract_end ?? ''} onChange={e => set('contract_end', e.target.value)} /></div>
              </div>
            </div>
          )}

          {error && <p role="alert" style={{ color: '#f87171', fontSize: 12, margin: 0 }}>{error}</p>}

          <button onClick={save} disabled={saving} style={{ width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700, backgroundColor: '#16a34a', color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Coach and create sign-in'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Coach Detail Modal ────────────────────────────────────────────────────────

const TABS = ['Profile', 'Teams', 'Session Log', 'Private Info'] as const
type Tab = typeof TABS[number]

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{value || '—'}</span>
    </div>
  )
}

function CoachDetailModal({
  coach, lookup, userRole, onEdit, onDelete, onCreateLogin, onClose,
}: {
  coach: CoachRow
  lookup: Lookup
  userRole: string
  onEdit: () => void
  onDelete: () => void
  onCreateLogin: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('Profile')

  // Attendance is still the localStorage system, so this only ever has rows
  // for sessions recorded through that screen. Real coaches start empty.
  const sessions = useMemo<SessionRecord[]>(() => {
    try {
      const all: SessionRecord[] = JSON.parse(localStorage.getItem('mila_attendance_sessions') ?? '[]')
      return all.filter(s => s.coach === coach.session_name)
    } catch {
      return []
    }
  }, [coach.session_name])

  const col = '#f5c518'

  useModal(onClose)

  return (
    <div {...modalOverlayProps} aria-label={`Coach ${coach.name}`} style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90dvh', overflowY: 'auto', padding: 'clamp(18px, 5vw, 28px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, backgroundColor: 'rgba(245,197,24,0.12)', border: '2px solid rgba(245,197,24,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: col, fontSize: 22, fontWeight: 800 }}>
            {initials(coach.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{coach.name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 8px' }}>{coach.specialty}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {coach.team_ids.map(tid => (
                <span key={tid} style={{ backgroundColor: `${lookup.color(tid)}22`, color: lookup.color(tid), fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{lookup.name(tid)}</span>
              ))}
              <span style={{ backgroundColor: 'rgba(245,197,24,0.1)', color: '#f5c518', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{coach.experience}y exp</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={20} /></button>
        </div>

        {userRole === 'admin' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={onEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              <IconPencil size={15} /> Edit
            </button>
            <button onClick={onDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', backgroundColor: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.3)' }}>
              <IconTrash size={15} /> Delete
            </button>
            {coach.has_login ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, backgroundColor: 'rgba(22,163,74,0.12)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.3)' }}>
                ✓ Can sign in
              </span>
            ) : (
              <button onClick={onCreateLogin} title="This coach has no sign-in yet" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', backgroundColor: 'rgba(245,197,24,0.12)', color: '#f5c518', border: '1px solid rgba(245,197,24,0.35)' }}>
                Create sign-in
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, backgroundColor: 'var(--bg)', borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {TABS.filter(t => t !== 'Private Info' || userRole === 'admin').map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
              backgroundColor: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>{t}</button>
          ))}
        </div>

        {/* Profile */}
        {tab === 'Profile' && (
          <div>
            {coach.bio && <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7, marginBottom: 16, padding: '12px 14px', backgroundColor: 'var(--bg)', borderRadius: 8 }}>{coach.bio}</p>}
            <InfoRow label="Nationality" value={coach.nationality} />
            <InfoRow label="Email" value={coach.email} />
            <InfoRow label="Date Joined" value={coach.joined ?? ''} />
            <InfoRow label="Languages" value={coach.languages.join(', ')} />
            <div style={{ padding: '10px 0' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>CERTIFICATIONS</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {coach.certifications.length === 0
                  ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                  : coach.certifications.map((c, i) => (
                    <span key={i} style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '0.5px solid rgba(59,130,246,0.25)', color: '#3b82f6', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{c}</span>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Teams */}
        {tab === 'Teams' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {coach.team_ids.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No teams assigned.</p>
            ) : coach.team_ids.map(tid => (
              <div key={tid} style={{ padding: '16px 18px', backgroundColor: 'var(--bg)', borderRadius: 10, border: `0.5px solid ${lookup.color(tid)}33` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: `${lookup.color(tid)}22`, border: `1.5px solid ${lookup.color(tid)}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: lookup.color(tid), fontSize: 9, fontWeight: 800, textAlign: 'center', lineHeight: 1.3 }}>
                    {lookup.name(tid).slice(0, 7)}
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, margin: 0 }}>{lookup.name(tid)}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>{lookup.academy(tid) ?? '—'} Academy</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Session Log */}
        {tab === 'Session Log' && (
          <div>
            {sessions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No sessions recorded for this coach yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {sessions.map((s, i) => {
                  const vals = Object.values(s.records) as string[]
                  const present = vals.filter(v => v === 'present').length
                  const rate = vals.length > 0 ? Math.round((vals.filter(v => v !== 'absent').length / vals.length) * 100) : 0
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: 0 }}>{s.date} · {s.team_name}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>{vals.length} students</p>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>{present} present</span>
                        <span style={{ color: rate >= 80 ? '#16a34a' : rate >= 60 ? '#f5c518' : '#ef4444', fontSize: 13, fontWeight: 700 }}>{rate}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Private Info (admin only) */}
        {tab === 'Private Info' && userRole === 'admin' && (
          <div style={{ padding: '16px', backgroundColor: 'rgba(245,197,24,0.04)', border: '0.5px solid rgba(245,197,24,0.15)', borderRadius: 10 }}>
            <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, margin: '0 0 14px', letterSpacing: '0.5px' }}>🔒 CONFIDENTIAL — ADMIN VIEW ONLY</p>
            <InfoRow label="Personal Phone" value={coach.phone} />
            <InfoRow label="Monthly Salary" value={coach.salary} />
            <InfoRow label="Contract End Date" value={coach.contract_end ?? ''} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Coach Card ────────────────────────────────────────────────────────────────

function CoachCard({ coach, lookup, onClick }: { coach: CoachRow; lookup: Lookup; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  const col = '#f5c518'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `0.5px solid ${hov ? 'rgba(245,197,24,0.3)' : 'var(--border)'}`,
        borderRadius: 14, padding: 22, cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, backgroundColor: 'rgba(245,197,24,0.1)', border: '2px solid rgba(245,197,24,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: col, fontSize: 17, fontWeight: 800 }}>
          {initials(coach.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{coach.name}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>{coach.specialty || '—'}</p>
        </div>
      </div>

      {/* Teams */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12, minHeight: 18 }}>
        {coach.team_ids.map(tid => (
          <span key={tid} style={{ backgroundColor: `${lookup.color(tid)}18`, color: lookup.color(tid), fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{lookup.name(tid)}</span>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {coach.joined ? `Since ${new Date(coach.joined).getFullYear()}` : '—'}
        </span>
        <span style={{ backgroundColor: `${expColor(coach.experience)}1a`, color: expColor(coach.experience), fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
          {coach.experience}y exp
        </span>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CoachesPage() {
  const { user: authUser, loading: authLoading } = useRequireAccess('coaches')
  const selectedAcademy = useSelectedAcademy()
  const enabled = !!authUser

  const { coaches, loading, error, reload } = useCoaches()
  const { data: teams } = useAdminData<TeamRow[]>('/api/admin/teams', enabled, [])
  const lookup = useTeamLookup(teams)

  const userRole = authUser?.role ?? 'student'
  const isAdmin = userRole === 'admin'

  const [selected,   setSelected]   = useState<CoachRow | null>(null)
  const [editing,    setEditing]    = useState<CoachRow | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [search,     setSearch]     = useState('')
  const [filterTeam, setFilterTeam] = useState('All')

  const [reveal, setReveal] = useState<{ name: string; login: NewLogin } | null>(null)

  function onSaved(verb: string, name: string, login?: NewLogin) {
    setShowForm(false)
    setEditing(null)
    setSelected(null)
    toast(`${name} ${verb} successfully`)
    if (login) setReveal({ name, login })
  }

  // A coach profile added before sign-ins were created together with it.
  async function createLogin(c: CoachRow) {
    const email = c.email?.trim() || (window.prompt(`Email for ${c.name}'s sign-in:`) ?? '').trim()
    if (!email) return
    try {
      const login = await createLoginForCoach(c.id, email)
      setSelected(null)
      setReveal({ name: c.name, login })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create the sign-in')
    }
  }

  async function removeCoach(c: CoachRow) {
    if (!confirmAction(`Delete ${c.name}? This cannot be undone.`)) return
    try {
      await deleteCoach(c.id)
      setSelected(null)
      toast(`${c.name} deleted`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete coach')
    }
  }

  const filtered = useMemo(() => coaches.filter(c => {
    if (selectedAcademy !== 'Both') {
      if (!c.team_ids.some(tid => lookup.academy(tid) === selectedAcademy)) return false
    }
    const q = search.toLowerCase()
    if (q && !c.name.toLowerCase().includes(q) && !c.specialty.toLowerCase().includes(q)) return false
    if (filterTeam !== 'All' && !c.team_ids.includes(filterTeam)) return false
    return true
  }), [coaches, search, filterTeam, selectedAcademy, lookup])

  const SEL: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8,
    color: 'var(--text-secondary)', fontSize: 13, padding: '9px 32px 9px 12px', outline: 'none',
    appearance: 'none', cursor: 'pointer',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 010 1.659l-4.796 5.48a1 1 0 01-1.506 0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '11px',
  }

  if (authLoading || !authUser) return null
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        .coaches-grid { display: grid; grid-template-columns: repeat(3,minmax(0, 1fr)); gap: 16px; }
        @media (max-width: 900px) { .coaches-grid { grid-template-columns: repeat(2,minmax(0, 1fr)); } }
        @media (max-width: 580px) { .coaches-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Coaches</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
            {loading ? 'Loading…' : `${coaches.length} ${coaches.length === 1 ? 'coach' : 'coaches'} across ${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditing(null); setShowForm(true) }} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <IconPlus size={16} stroke={2.5} /> Add Coach
          </button>
        )}
      </div>

      {error && (
        <div role="alert" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <span>{error}</span>
          <button onClick={() => void reload()} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, padding: '6px 12px', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search coaches…"
          style={{ ...FIELD, maxWidth: 220, padding: '9px 12px' }}
        />
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={SEL}>
          <option value="All">All Teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div className="coaches-grid">
        {filtered.map(c => (
          <CoachCard key={c.id} coach={c} lookup={lookup} onClick={() => setSelected(c)} />
        ))}
        {filtered.length === 0 && !loading && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            {coaches.length === 0 ? 'No coaches yet.' : 'No coaches match your search.'}
          </div>
        )}
      </div>

      {selected && (
        <CoachDetailModal
          coach={selected}
          lookup={lookup}
          userRole={userRole}
          onEdit={() => { setEditing(selected); setShowForm(true) }}
          onDelete={() => void removeCoach(selected)}
          onCreateLogin={() => void createLogin(selected)}
          onClose={() => setSelected(null)}
        />
      )}
      {reveal && <LoginDetailsModal name={reveal.name} login={reveal.login} onClose={() => setReveal(null)} />}
      {showForm && (
        <CoachFormModal
          coach={editing}
          teams={teams}
          lookup={lookup}
          userRole={userRole}
          onDone={onSaved}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
