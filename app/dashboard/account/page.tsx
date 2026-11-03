'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changePassword } from '@/lib/auth'
import { useSession } from '@/lib/use-session'
import { toast } from '../components/toast'
import { PageHeader, Card, Button, TextField, ErrorBanner, Badge, GOLD } from '../components/admin-ui'
import DocumentsPanel from '../components/DocumentsPanel'

const MIN = 8

// Every signed-in user's own page: who they are and a password change. Users
// created or reset by an admin are sent here first to replace their
// temporary password.
export default function AccountPage() {
  const { user } = useSession()
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null
  const me = user
  const forced = !!me.mustChangePassword

  const problem =
    next && next.length < MIN ? `At least ${MIN} characters` :
    confirm && next !== confirm ? 'The two new passwords don’t match' : ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (problem || !current || !next) return
    setSaving(true)
    setError('')
    const err = await changePassword(current, next)
    setSaving(false)
    if (err) { setError(err); return }
    setCurrent(''); setNext(''); setConfirm('')
    toast('Password changed', 'success')
    if (forced) {
      router.replace(me.role === 'parent' || me.role === 'student'
        ? `/dashboard/students/${me.studentId ?? ''}`
        : '/dashboard')
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader title="My Account" subtitle="Your sign-in details." />

      {forced && (
        <div style={{
          backgroundColor: 'rgba(245,197,24,0.1)', border: `1px solid ${GOLD}55`, borderRadius: 10,
          padding: '12px 16px', color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5, marginBottom: 16,
        }}>
          <strong>Choose your own password to continue.</strong> You signed in with a temporary password set by an administrator.
        </div>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '10px 18px', fontSize: 14 }}>
          <span style={{ color: 'var(--text-muted)' }}>Name</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user.name}</span>
          <span style={{ color: 'var(--text-muted)' }}>Email</span>
          <span style={{ color: 'var(--text-primary)' }}>{user.email}</span>
          <span style={{ color: 'var(--text-muted)' }}>Role</span>
          <span><Badge>{user.role}</Badge></span>
          <span style={{ color: 'var(--text-muted)' }}>Academies</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {user.academies.map(a => <Badge key={a} color={a === 'MFA' ? '#16a34a' : '#f97316'}>{a}</Badge>)}
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '14px 0 0' }}>
          To change your name, email or role, ask an administrator.
        </p>
      </Card>

      {user.role !== 'parent' && user.role !== 'student' && !forced && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>My photo and documents</h2>
          <DocumentsPanel ownerType="user" ownerId={user.id} meId={user.id} isAdmin={user.role === 'admin'} />
        </div>
      )}

      <Card>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Change password</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <ErrorBanner message={error} />}
          <TextField label={forced ? 'Temporary password' : 'Current password'} type="password" value={current} onChange={setCurrent} autoComplete="current-password" required />
          <TextField label="New password" type="password" value={next} onChange={setNext} autoComplete="new-password" help={`At least ${MIN} characters.`} required />
          <TextField label="Confirm new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" required />
          {problem && <span style={{ color: '#f87171', fontSize: 12 }}>{problem}</span>}
          <div>
            <Button type="submit" disabled={saving || !!problem || !current || !next || !confirm}>
              {saving ? 'Saving…' : 'Change password'}
            </Button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
            Changing your password signs you out on every other device.
          </p>
        </form>
      </Card>
    </div>
  )
}
