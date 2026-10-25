'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function ResetForm() {
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setError(body?.error ?? 'Something went wrong. Try again.')
      else setDone(true)
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const input = {
    width: '100%', padding: '14px 12px', boxSizing: 'border-box' as const, backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  }

  if (!token) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
        This page needs the link from your reset email.{' '}
        <Link href="/dashboard/forgot-password" style={{ color: '#f5c518' }}>Request a new one</Link>.
      </p>
    )
  }

  if (done) {
    return (
      <>
        <div style={{ backgroundColor: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 8, padding: '12px 14px', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6 }}>
          Your password has been changed. You can sign in with it now.
        </div>
        <p style={{ margin: '22px 0 0', fontSize: 13 }}>
          <Link href="/dashboard/login" style={{ color: '#f5c518', textDecoration: 'none' }}>Go to sign in →</Link>
        </p>
      </>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input type="password" required minLength={8} autoComplete="new-password" placeholder="New password (8+ characters)"
        value={password} onChange={e => setPassword(e.target.value)} style={input} />
      <input type="password" required autoComplete="new-password" placeholder="Repeat new password"
        value={confirm} onChange={e => setConfirm(e.target.value)} style={input} />
      {error && (
        <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>
          {error}{' '}
          {/invalid or has expired/.test(error) && <Link href="/dashboard/forgot-password" style={{ color: '#f5c518' }}>Request a new link</Link>}
        </p>
      )}
      <button type="submit" disabled={loading || !password || !confirm} style={{
        height: 48, borderRadius: 8, border: 'none', backgroundColor: '#f5c518', color: '#000', fontSize: 15, fontWeight: 700,
        cursor: loading ? 'default' : 'pointer', opacity: loading || !password || !confirm ? 0.6 : 1,
      }}>
        {loading ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        width: '100%', maxWidth: 420, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 'clamp(28px, 7vw, 40px) clamp(20px, 6vw, 36px)',
      }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Choose a new password</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: '0 0 24px' }}>
          This link works once and expires after an hour.
        </p>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
