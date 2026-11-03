'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  IconPlus, IconPencil, IconTrash, IconKey, IconCopy, IconSearch, IconLock, IconLockOpen, IconFolder,
} from '@tabler/icons-react'
import { useRequireAccess } from '../hooks/useRequireAccess'
import { refreshSession } from '@/lib/auth'
import { toast } from '../components/toast'
import { fetchStudents, fetchTeams, type TeamRow } from '../students/api'
import DocumentsPanel from '../components/DocumentsPanel'
import type { StudentRow } from '../students/data'
import {
  api, useAdminData, PageHeader, Card, Button, TextField, SelectField, Toggle, Modal,
  Loading, ErrorBanner, EmptyState, Badge, confirmAction, GOLD,
} from '../components/admin-ui'

type Role = 'admin' | 'coach' | 'parent' | 'student'
type Academy = 'MFA' | 'MBA'

interface UserRow {
  id: string
  email: string
  role: Role
  name: string
  academies: Academy[]
  team_id: string | null
  student_id: string | null
  disabled: boolean
  must_change_password: boolean
  last_login_at: string | null
  created_at: string
}

const ROLE_INFO: Record<Role, { label: string; color: string; description: string }> = {
  admin:   { label: 'Admin',   color: '#f5c518', description: 'Full access: everything in the dashboard, the website editor, and user accounts.' },
  coach:   { label: 'Coach',   color: '#16a34a', description: 'Students, attendance, matches, coaches, ratings and reports. No payments, website editing or accounts.' },
  parent:  { label: 'Parent',  color: '#3b82f6', description: 'Read-only view of their own child’s profile and matches.' },
  student: { label: 'Student', color: '#a855f7', description: 'Read-only view of their own profile and matches.' },
}

// ── Temporary password reveal ────────────────────────────────────────────────

function TempPasswordModal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(`Email: ${email}\nTemporary password: ${password}`)
      toast('Copied to clipboard', 'success')
    } catch {
      toast('Copy failed — select the password and copy it manually', 'error')
    }
  }
  return (
    <Modal title="Share these sign-in details" onClose={onClose} width={460}
      footer={<><Button variant="secondary" onClick={copy}><IconCopy size={14} /> Copy</Button><Button onClick={onClose}>Done</Button></>}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
        Send these to the user. This password is shown <strong>only once</strong>, and they will be asked to choose their own password when they first sign in.
      </p>
      <div style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontFamily: 'var(--font-geist-mono), monospace', fontSize: 14, lineHeight: 1.8 }}>
        <div><span style={{ color: 'var(--text-muted)' }}>Sign in at: </span><span style={{ color: 'var(--text-primary)' }}>{typeof window !== 'undefined' ? `${window.location.origin}/dashboard/login` : '/dashboard/login'}</span></div>
        <div><span style={{ color: 'var(--text-muted)' }}>Email: </span><span style={{ color: 'var(--text-primary)' }}>{email}</span></div>
        <div><span style={{ color: 'var(--text-muted)' }}>Password: </span><span style={{ color: GOLD, fontWeight: 700, userSelect: 'all' }}>{password}</span></div>
      </div>
    </Modal>
  )
}

// ── Reset password ───────────────────────────────────────────────────────────
// The admin can type a password to hand over directly, or leave it empty to
// have one generated. Either way the user is signed out everywhere and has to
// choose their own on the next sign-in.

function ResetPasswordModal({
  target, onClose, onDone,
}: {
  target: UserRow
  onClose: () => void
  onDone: (creds: { email: string; password: string }) => void
}) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const { temporaryPassword } = await api<{ temporaryPassword: string }>(
        `/api/admin/users/${target.id}/password`,
        { method: 'POST', json: password.trim() === '' ? {} : { password } },
      )
      onDone({ email: target.email, password: temporaryPassword })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Set ${target.name}'s password`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving}>{saving ? 'Saving…' : 'Set password'}</Button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text-primary)' }}>{target.email}</strong> will be signed out on every device and
        asked to choose their own password the next time they sign in.
      </p>
      <TextField
        label="New password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        help="Leave empty to generate one for them. Minimum 8 characters."
      />
      {error && <p role="alert" style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}
    </Modal>
  )
}

// ── Create / edit ────────────────────────────────────────────────────────────

function UserModal({
  initial, teams, students, isSelf, onClose, onSaved,
}: {
  initial: UserRow | null; teams: TeamRow[]; students: StudentRow[]; isSelf: boolean
  onClose: () => void; onSaved: (created?: { email: string; password: string }) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [role, setRole] = useState<Role>(initial?.role ?? 'coach')
  const [academies, setAcademies] = useState<Academy[]>(initial?.academies ?? ['MFA', 'MBA'])
  const [teamId, setTeamId] = useState(initial?.team_id ?? '')
  const [studentId, setStudentId] = useState(initial?.student_id ?? '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleAcademy = (a: Academy) => (on: boolean) =>
    setAcademies(list => (on ? [...new Set([...list, a])] : list.filter(x => x !== a)))

  // Keep the academies in line with a linked team/student — a coach of an MFA
  // team, or the parent of an MBA player, only needs that academy.
  function pickTeam(id: string) {
    setTeamId(id)
    const t = teams.find(x => x.id === id)
    if (t) setAcademies([t.academy])
  }
  function pickStudent(id: string) {
    setStudentId(id)
    const s = students.find(x => x.id === id)
    if (s) setAcademies([s.academy])
  }

  async function save() {
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = {
      name, email, role, academies,
      team_id: role === 'coach' ? teamId || null : null,
      student_id: role === 'parent' || role === 'student' ? studentId || null : null,
    }
    try {
      if (initial) {
        await api(`/api/admin/users/${initial.id}`, { method: 'PATCH', json: body })
        toast('User updated', 'success')
        onSaved()
      } else {
        const res = await api<{ temporaryPassword: string }>('/api/admin/users', { method: 'POST', json: { ...body, password } })
        toast('User created', 'success')
        onSaved({ email: email.trim().toLowerCase(), password: res.temporaryPassword })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const needsStudent = role === 'parent' || role === 'student'

  return (
    <Modal
      title={initial ? `Edit ${initial.name}` : 'Add user'}
      onClose={onClose}
      width={580}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving || !name.trim() || !email.trim() || academies.length === 0}>
          {saving ? 'Saving…' : initial ? 'Save' : 'Create user'}
        </Button>
      </>}
    >
      {error && <ErrorBanner message={error} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14 }}>
        <TextField label="Full name" value={name} onChange={setName} required />
        <TextField label="Email" type="email" value={email} onChange={setEmail} required autoComplete="off" />
      </div>

      <div>
        <SelectField
          label="Role"
          value={role}
          onChange={v => setRole(v as Role)}
          options={(Object.keys(ROLE_INFO) as Role[]).map(r => ({ value: r, label: ROLE_INFO[r].label }))}
          help={isSelf && initial?.role === 'admin' ? 'You can’t remove your own admin role — ask another admin.' : undefined}
        />
        <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '6px 0 0', lineHeight: 1.5 }}>{ROLE_INFO[role].description}</p>
      </div>

      {role === 'coach' && (
        <SelectField label="Team" value={teamId} onChange={pickTeam}
          help="Coaches linked to a team see that team’s players by default."
          options={[{ value: '', label: 'No specific team (all teams in their academies)' },
            ...teams.map(t => ({ value: t.id, label: `${t.name} · ${t.academy}` }))]} />
      )}
      {needsStudent && (
        <SelectField label={role === 'parent' ? 'Their child' : 'Student record'} value={studentId} onChange={pickStudent}
          help={students.length === 0 ? 'No students exist yet — add them on the Students page first.' : 'They will only be able to see this student.'}
          options={[{ value: '', label: '— Choose a student —' },
            ...students.map(s => ({ value: s.id, label: `${s.name} · ${s.academy}` }))]} />
      )}

      <div>
        <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Academies</p>
        <div style={{ display: 'flex', gap: 20 }}>
          <Toggle label="Football (MFA)" checked={academies.includes('MFA')} onChange={toggleAcademy('MFA')} />
          <Toggle label="Basketball (MBA)" checked={academies.includes('MBA')} onChange={toggleAcademy('MBA')} />
        </div>
      </div>

      {!initial && (
        <TextField
          label="Password (optional)"
          type="text"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          help="Leave empty to generate a temporary password. Either way, they choose their own on first sign-in. Minimum 8 characters."
        />
      )}
    </Modal>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UsersAdminPage() {
  const { user, loading: guardLoading } = useRequireAccess('users')
  const { data: users, setData: setUsers, loading, error, reload: load } =
    useAdminData<UserRow[]>('/api/admin/users', !!user, [])
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [editing, setEditing] = useState<UserRow | null | 'new'>(null)
  const [resetting, setResetting] = useState<UserRow | null>(null)
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null)
  const [docsFor, setDocsFor] = useState<UserRow | null>(null)

  // Teams/students only feed the link pickers and labels; the page works without them.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchTeams().then(t => { if (!cancelled) setTeams(t) }).catch(() => {})
    fetchStudents().then(s => { if (!cancelled) setStudents(s) }).catch(() => {})
    return () => { cancelled = true }
  }, [user])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter(u =>
      (roleFilter === 'all' || u.role === roleFilter) &&
      (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    )
  }, [users, query, roleFilter])

  const linkLabel = (u: UserRow) => {
    if (u.role === 'coach') return u.team_id ? teams.find(t => t.id === u.team_id)?.name ?? 'Linked team' : 'All teams'
    if (u.role === 'parent' || u.role === 'student') {
      return u.student_id ? students.find(s => s.id === u.student_id)?.name ?? 'Linked student' : 'Not linked yet'
    }
    return ''
  }

  async function setDisabled(u: UserRow, disabled: boolean) {
    if (disabled && !confirmAction(`Disable ${u.name}? They are signed out immediately and can't sign in until re-enabled.`)) return
    try {
      await api(`/api/admin/users/${u.id}`, { method: 'PATCH', json: { disabled } })
      setUsers(list => list.map(x => (x.id === u.id ? { ...x, disabled } : x)))
      toast(disabled ? `${u.name} disabled` : `${u.name} can sign in again`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Update failed', 'error')
    }
  }

  function onPasswordSet(creds: { email: string; password: string }) {
    setUsers(list => list.map(x => (x.email === creds.email ? { ...x, must_change_password: true } : x)))
    setReveal(creds)
  }

  async function remove(u: UserRow) {
    if (!confirmAction(`Delete ${u.name}'s account (${u.email})? This cannot be undone. To block access but keep the account, disable it instead.`)) return
    try {
      await api(`/api/admin/users/${u.id}`, { method: 'DELETE' })
      setUsers(list => list.filter(x => x.id !== u.id))
      toast('User deleted', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error')
    }
  }

  if (guardLoading || !user) return null

  const counts = (Object.keys(ROLE_INFO) as Role[]).map(r => [r, users.filter(u => u.role === r).length] as const)

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Everyone who can sign in to the dashboard. Add staff and families, choose what they can see, reset passwords, or disable access."
        actions={<Button onClick={() => setEditing('new')}><IconPlus size={15} /> Add user</Button>}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)',
          borderRadius: 8, padding: '0 12px', flex: '1 1 220px', maxWidth: 320,
        }}>
          <IconSearch size={15} style={{ color: 'var(--text-muted)' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or email" aria-label="Search users"
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, padding: '9px 0', flex: 1, fontFamily: 'inherit' }} />
        </div>
        <Button variant={roleFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setRoleFilter('all')} style={{ minHeight: 32, padding: '6px 12px' }}>
          All ({users.length})
        </Button>
        {counts.map(([r, n]) => (
          <Button key={r} variant={roleFilter === r ? 'primary' : 'secondary'} onClick={() => setRoleFilter(r)} style={{ minHeight: 32, padding: '6px 12px' }}>
            {ROLE_INFO[r].label}s ({n})
          </Button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? <Loading /> : shown.length === 0 ? (
        <EmptyState>No users match.</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(u => {
            const self = u.id === user.id
            const info = ROLE_INFO[u.role]
            return (
              <Card key={u.id} style={{ padding: '14px 16px', opacity: u.disabled ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: `${info.color}22`, border: `1.5px solid ${info.color}66`, color: info.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
                  }}>
                    {u.name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{u.name}</span>
                      {self && <Badge color="#888888">You</Badge>}
                      <Badge color={info.color}>{info.label}</Badge>
                      {u.academies.map(a => <Badge key={a} color={a === 'MFA' ? '#16a34a' : '#f97316'}>{a}</Badge>)}
                      {u.disabled && <Badge color="#ef4444">Disabled</Badge>}
                      {!u.disabled && u.must_change_password && <Badge color="#888888">Temporary password</Badge>}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {[u.email, linkLabel(u), u.last_login_at
                        ? `Last sign-in ${new Date(u.last_login_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : 'Never signed in'].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Button variant="secondary" onClick={() => setEditing(u)}><IconPencil size={14} /> Edit</Button>
                    <Button variant="secondary" onClick={() => setDocsFor(u)} title="Photo and legal papers"><IconFolder size={14} /> Documents</Button>
                    {!self && <Button variant="secondary" onClick={() => setResetting(u)} title="Set or reset this user's password"><IconKey size={14} /> Set password</Button>}
                    {!self && (u.disabled
                      ? <Button variant="secondary" onClick={() => setDisabled(u, false)}><IconLockOpen size={14} /> Enable</Button>
                      : <Button variant="secondary" onClick={() => setDisabled(u, true)}><IconLock size={14} /> Disable</Button>)}
                    {!self && <Button variant="danger" onClick={() => remove(u)} title="Delete"><IconTrash size={14} /></Button>}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 16 }}>
        To change your own password, use <a href="/dashboard/account" style={{ color: GOLD }}>My Account</a>.
      </p>

      {editing && (
        <UserModal
          initial={editing === 'new' ? null : editing}
          teams={teams}
          students={students}
          isSelf={editing !== 'new' && editing.id === user.id}
          onClose={() => setEditing(null)}
          onSaved={created => { load(); refreshSession(); if (created) setReveal(created) }}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          target={resetting}
          onClose={() => setResetting(null)}
          onDone={onPasswordSet}
        />
      )}
      {docsFor && user && (
        <Modal title={`${docsFor.name} — photo and documents`} onClose={() => setDocsFor(null)} width={680}>
          <DocumentsPanel ownerType="user" ownerId={docsFor.id} meId={user.id} isAdmin />
        </Modal>
      )}
      {reveal && <TempPasswordModal email={reveal.email} password={reveal.password} onClose={() => setReveal(null)} />}
    </div>
  )
}
