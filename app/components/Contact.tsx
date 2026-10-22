'use client'
import { useState } from 'react'
import { IconMapPin, IconPhone, IconMail, IconClock } from '@tabler/icons-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { SiteContent } from '@/lib/content-schema'

// ── Inline SVGs ───────────────────────────────────────────────────────────────

function WaSvg({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function IgSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

function FbSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function YtSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
      <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
    </svg>
  )
}

// ── Floating-label field ──────────────────────────────────────────────────────

function FloatingField({
  label,
  type = 'text',
  value,
  onChange,
  multiline = false,
  required = false,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  required?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const up = focused || value.length > 0
  const Tag = multiline ? 'textarea' : 'input'

  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      <label style={{
        position: 'absolute',
        left: 14,
        top: up ? 0 : (multiline ? '14px' : '50%'),
        transform: up ? 'translateY(-50%)' : (multiline ? 'none' : 'translateY(-50%)'),
        fontSize: up ? 11 : 14,
        color: up ? 'var(--color-gold)' : 'var(--color-text-faintest)',
        transition: 'all 0.18s ease',
        pointerEvents: 'none',
        backgroundColor: up ? 'var(--color-bg)' : 'transparent',
        padding: up ? '0 4px' : '0',
        zIndex: 1,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </label>

      <Tag
        type={type}
        value={value}
        required={required}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={multiline ? 4 : undefined}
        style={{
          width: '100%',
          padding: multiline ? '14px' : '15px 14px',
          backgroundColor: 'var(--color-surface)',
          border: `1px solid ${focused ? 'var(--color-gold)' : 'var(--color-border-soft)'}`,
          borderRadius: 8,
          color: 'var(--color-text)',
          fontSize: 14,
          outline: 'none',
          resize: multiline ? ('vertical' as const) : undefined,
          transition: 'border-color 0.18s ease',
          fontFamily: 'inherit',
          minHeight: multiline ? 100 : undefined,
          display: 'block',
        }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Contact({ content }: { content: SiteContent }) {
  const settings = content
  // Skip entries the site settings haven't been filled in for, rather than
  // rendering a card with a label and a blank value under it.
  const INFO = [
    { Icon: IconMapPin, label: 'Location',       value: settings.location     },
    { Icon: IconPhone,  label: 'Phone',          value: settings.phone_display },
    { Icon: IconMail,   label: 'Email',          value: settings.email        },
    { Icon: IconClock,  label: 'Training Hours', value: settings.hours        },
  ].filter(i => i.value)

  const SOCIALS = [
    { href: settings.instagram_url, icon: <IgSvg />, label: 'Instagram' },
    { href: settings.facebook_url,  icon: <FbSvg />, label: 'Facebook'  },
    { href: settings.youtube_url,   icon: <YtSvg />, label: 'YouTube'   },
  ].filter(s => s.href && s.href !== '#')
  const [form, setForm] = useState({ name: '', email: '', phone: '', age: '', academy: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')

    if (!isSupabaseConfigured) {
      setStatus('error')
      return
    }

    const { error } = await supabase.from('enrollment_inquiries').insert({
      name: form.name,
      email: form.email,
      phone: form.phone,
      child_age: form.age ? Number(form.age) : null,
      academy: form.academy,
      message: form.message || null,
    })

    if (error) {
      setStatus('error')
      return
    }

    setStatus('done')
    setForm({ name: '', email: '', phone: '', age: '', academy: '', message: '' })
  }

  return (
    <section id="contact" style={{ backgroundColor: 'var(--color-bg)', padding: 'clamp(64px, 12vw, 100px) 20px' }}>
      <style>{`
        .contact-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 80px; max-width: 1100px; margin: 0 auto; }
        @media (max-width: 900px) { .contact-grid { grid-template-columns: minmax(0, 1fr); gap: 56px; } }
        @keyframes wa-pulse-inner {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37,211,102,0.5); }
          50%       { box-shadow: 0 0 0 12px rgba(37,211,102,0); }
        }
        @keyframes contact-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="contact-grid">

        {/* ── LEFT — Form ───────────────────────────────────────────────────── */}
        <div>
          <h2 className="display" style={{ color: 'var(--color-text)', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, margin: '0 0 36px', lineHeight: 1.15 }}>
            {content.contact_title}
          </h2>

          <form onSubmit={handleSubmit}>
            <FloatingField label="Full Name"    value={form.name}    onChange={set('name')}  required />
            <FloatingField label="Email"        type="email" value={form.email}   onChange={set('email')} required />
            <FloatingField label="Phone"        type="tel"   value={form.phone}   onChange={set('phone')} />
            <FloatingField label="Child's Age"  type="number" value={form.age}   onChange={set('age')}   />

            {/* Select dropdown */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <label style={{
                position: 'absolute',
                left: 14,
                top: form.academy ? 0 : '50%',
                transform: 'translateY(-50%)',
                fontSize: form.academy ? 11 : 14,
                color: form.academy ? 'var(--color-gold)' : 'var(--color-text-faintest)',
                transition: 'all 0.18s ease',
                pointerEvents: 'none',
                backgroundColor: form.academy ? 'var(--color-bg)' : 'transparent',
                padding: form.academy ? '0 4px' : '0',
                zIndex: 1,
                lineHeight: 1,
              }}>
                Select Academy
              </label>
              <select
                value={form.academy}
                required
                aria-label="Select Academy"
                onChange={e => setForm(p => ({ ...p, academy: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '15px 36px 15px 14px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border-soft)',
                  borderRadius: 8,
                  color: form.academy ? 'var(--color-text)' : 'transparent',
                  fontSize: 14,
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 010 1.659l-4.796 5.48a1 1 0 01-1.506 0z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                  backgroundSize: '12px',
                  transition: 'border-color 0.18s ease',
                }}
              >
                <option value="" disabled />
                <option value="mfa">{content.football_name}</option>
                <option value="mba">{content.basketball_name}</option>
              </select>
            </div>

            <FloatingField label="Message (optional)" value={form.message} onChange={set('message')} multiline />

            {/* Submit button */}
            <button
              type="submit"
              disabled={status === 'loading' || status === 'done'}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 8,
                border: 'none',
                backgroundColor: status === 'done' ? 'var(--color-football)' : 'var(--color-gold)',
                color: status === 'done' ? '#fff' : '#000',
                fontSize: 15,
                fontWeight: 700,
                cursor: status === 'loading' || status === 'done' ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'background-color 0.3s ease',
              }}
            >
              {status === 'loading' && (
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid rgba(0,0,0,0.2)',
                  borderTopColor: '#000',
                  animation: 'contact-spin 0.7s linear infinite',
                  display: 'inline-block',
                }} />
              )}
              {(status === 'idle' || status === 'error') && content.contact_submit}
              {status === 'loading' && 'Sending…'}
              {status === 'done'    && content.contact_success}
            </button>

            {status === 'error' && (
              <p style={{ color: '#f87171', fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                {content.contact_error}
              </p>
            )}
          </form>
        </div>

        {/* ── RIGHT — Info ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* WhatsApp CTA — hidden entirely if no number is configured, since
              https://wa.me/ with no number is a dead link. */}
          {settings.whatsapp_number && (
          <a
            href={`https://wa.me/${settings.whatsapp_number}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              backgroundColor: '#25D366',
              color: '#fff',
              padding: '16px 28px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 16,
              textDecoration: 'none',
              animation: 'wa-pulse-inner 2.4s ease-in-out infinite',
            }}
          >
            <WaSvg size={24} />
            {content.whatsapp_label}
          </a>
          )}

          {/* Info cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {INFO.map(({ Icon, label, value }) => (
              <div key={label} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                backgroundColor: 'var(--color-surface)',
                border: '0.5px solid var(--color-border)',
                borderRadius: 10,
                padding: '14px 18px',
              }}>
                <Icon size={20} stroke={1.75} style={{ color: 'var(--color-gold)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ color: 'var(--color-text-faint)', fontSize: 11, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 3px' }}>{label}</p>
                  <p style={{ color: 'var(--color-text)', fontSize: 14, margin: 0 }}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Social icons */}
          {SOCIALS.length > 0 && (
          <div>
            <p style={{ color: 'var(--color-text-faintest)', fontSize: 11, fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 14px' }}>
              {content.contact_follow}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {SOCIALS.map(({ href, icon, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(var(--color-gold-rgb),0.1)',
                    border: '1px solid rgba(var(--color-gold-rgb),0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-gold)',
                    textDecoration: 'none',
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>
    </section>
  )
}
