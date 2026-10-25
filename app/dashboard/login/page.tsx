'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { login } from '@/lib/auth'

// ── Floating label input ───────────────────────────────────────────────────────

function FloatingField({
  label, type = 'text', value, onChange,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void
}) {
  const [focused, setFocused] = useState(false)
  const lifted = focused || value.length > 0
  return (
    <div style={{ position: 'relative' }}>
      <label style={{
        position: 'absolute', left: 14,
        top: '50%',
        transform: lifted ? 'translateY(-160%)' : 'translateY(-50%)',
        fontSize: lifted ? 11 : 14,
        color: lifted ? '#f5c518' : 'var(--text-muted)',
        backgroundColor: 'var(--bg-card)', padding: lifted ? '0 4px' : '0',
        transition: 'all 0.18s ease', pointerEvents: 'none',
        zIndex: 1, lineHeight: 1, whiteSpace: 'nowrap',
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={type === 'password' ? 'current-password' : 'email'}
        style={{
          width: '100%', padding: '16px 14px',
          backgroundColor: 'var(--bg-card)',
          border: `1px solid ${focused ? '#f5c518' : 'var(--border)'}`,
          borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, outline: 'none',
          transition: 'border-color 0.18s ease', fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ── Login page ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(email, password)

    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }
    const session = result.user

    // Accounts created or reset by an admin start with a temporary password.
    if (session.mustChangePassword) {
      router.replace('/dashboard/account?first=1')
      return
    }

    // Role-based redirect
    if (session.role === 'parent' || session.role === 'student') {
      router.replace(`/dashboard/students/${session.studentId ?? ''}`)
    } else {
      router.replace('/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <style>{`@keyframes login-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        width: '100%', maxWidth: 420,
        backgroundColor: 'var(--bg-card)', border: '1px solid rgba(245,197,24,0.15)',
        borderRadius: 16, padding: 'clamp(28px, 7vw, 40px) clamp(20px, 6vw, 36px)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      }}>

        {/* Logos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
          <Image src="/logos/mfa_navbar.png" alt="MFA" width={64} height={40} style={{ height: 40, width: 'auto' }} loading="eager" />
          <div style={{ width: 1, height: 32, backgroundColor: '#f5c518', opacity: 0.35 }} />
          <Image src="/logos/mba_navbar.png" alt="MBA" width={64} height={40} style={{ height: 40, width: 'auto' }} loading="eager" />
        </div>

        <h1 style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, textAlign: 'center', margin: '0 0 4px', lineHeight: 1.2 }}>
          Mila Academy Dashboard
        </h1>
        <p style={{ color: '#f5c518', fontSize: 12, textAlign: 'center', margin: '0 0 28px', letterSpacing: '0.5px' }}>
          Where Champions Are Made
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FloatingField label="Email address" type="email" value={email} onChange={setEmail} />
          <FloatingField label="Password" type="password" value={password} onChange={setPassword} />

          {error && (
            <div style={{
              backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: '100%', height: 50, marginTop: 4, borderRadius: 8, border: 'none',
              backgroundColor: loading ? '#c9a100' : '#f5c518',
              color: '#000', fontSize: 15, fontWeight: 700,
              cursor: loading || !email || !password ? 'default' : 'pointer',
              opacity: !email || !password ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'background-color 0.2s ease, opacity 0.2s ease',
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000',
                  animation: 'login-spin 0.7s linear infinite', display: 'inline-block',
                }} />
                Signing in…
              </>
            ) : 'Sign in'}
          </button>
          <Link href="/dashboard/forgot-password" style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>
            Forgot password?
          </Link>
        </form>

      </div>
    </div>
  )
}
