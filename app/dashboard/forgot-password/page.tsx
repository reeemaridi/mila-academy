'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setError(body?.error ?? 'Something went wrong. Try again.')
      else setMessage(body.message)
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        width: '100%', maxWidth: 420, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 'clamp(28px, 7vw, 40px) clamp(20px, 6vw, 36px)',
      }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Forgot your password?</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: '0 0 24px' }}>
          Enter your account email and we&apos;ll send you a link to choose a new one.
        </p>

        {message ? (
          <div style={{ backgroundColor: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 8, padding: '12px 14px', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6 }}>
            {message}
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              type="email" required autoComplete="email" placeholder="Email address" value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%', padding: '14px 12px', boxSizing: 'border-box', backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, outline: 'none',
              }}
            />
            {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading || !email} style={{
              height: 48, borderRadius: 8, border: 'none', backgroundColor: '#f5c518', color: '#000', fontSize: 15, fontWeight: 700,
              cursor: loading || !email ? 'default' : 'pointer', opacity: loading || !email ? 0.6 : 1,
            }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p style={{ margin: '22px 0 0', fontSize: 13 }}>
          <Link href="/dashboard/login" style={{ color: '#f5c518', textDecoration: 'none' }}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
