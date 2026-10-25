'use client'
// Shared building blocks for the admin editing screens (Website, Programs,
// Testimonials, Gallery, Inquiries, Users, Account). Styled with the same
// CSS variables and gold accent as the rest of the dashboard.

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { IconX, IconUpload, IconPhoto, IconExternalLink } from '@tabler/icons-react'
import { useModal, modalOverlayProps } from '../hooks/useModal'
import { logout } from '@/lib/auth'

export const GOLD = '#f5c518'

// ── API helper ────────────────────────────────────────────────────────────────

/** fetch + JSON, throwing an Error with the server's message on failure. */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') void logout().finally(() => { window.location.href = '/dashboard/login' })
      throw new Error('Your session has ended — sign in again.')
    }
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return body as T
}

/**
 * Loads `{ data }` from an admin endpoint once `enabled` (i.e. the access guard
 * has passed). `reload()` refetches; `setData` allows optimistic local edits.
 * The fetch starts inside the effect and only sets state in its callbacks, the
 * same shape the Students page uses.
 */
export function useAdminData<T>(url: string, enabled: boolean, initial: T) {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    api<{ data: T }>(url)
      .then(res => { if (!cancelled) { setData(res.data); setError('') } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url, enabled, version])

  const reload = useCallback(() => setVersion(v => v + 1), [])
  return { data, setData, loading, error, reload }
}

/** Upload an image to site storage; resolves to its public URL. */
export async function uploadImage(file: File, folder: 'content' | 'programs' = 'content'): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  const { url } = await api<{ url: string }>('/api/admin/assets', { method: 'POST', body: form })
  return url
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: 26, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '6px 0 0', maxWidth: 640, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)',
      borderRadius: 12, padding: 20, ...style,
    }}>
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14,
      border: '1px dashed var(--border)', borderRadius: 12,
    }}>
      {children}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '24px 0' }}>{label}</p>
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" style={{
      backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16,
    }}>
      <span>{message}</span>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  )
}

export function Badge({ children, color = GOLD }: { children: ReactNode; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, backgroundColor: `${color}22`, color, border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

// ── Buttons ───────────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, CSSProperties> = {
  primary:   { backgroundColor: GOLD, color: '#000', border: 'none' },
  secondary: { backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' },
  danger:    { backgroundColor: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.3)' },
  ghost:     { backgroundColor: 'transparent', color: 'var(--text-secondary)', border: 'none' },
}

export function Button({
  children, variant = 'primary', onClick, type = 'button', disabled, title, style,
}: {
  children: ReactNode; variant?: Variant; onClick?: () => void; type?: 'button' | 'submit'
  disabled?: boolean; title?: string; style?: CSSProperties
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
        transition: 'opacity 0.15s ease', whiteSpace: 'nowrap', minHeight: 38,
        ...VARIANTS[variant], ...style,
      }}
    >
      {children}
    </button>
  )
}

/** Opens the public site in a new tab, styled as a secondary button. */
export function ViewSiteLink({ href = '/', label = 'View site' }: { href?: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
        fontSize: 13, fontWeight: 700, textDecoration: 'none', minHeight: 38, boxSizing: 'border-box',
        ...VARIANTS.secondary,
      }}
    >
      <IconExternalLink size={15} /> {label}
    </a>
  )
}

// ── Form fields ───────────────────────────────────────────────────────────────

const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
  backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
}

export function FieldLabel({ label, help, htmlFor, extra }: { label: string; help?: string; htmlFor?: string; extra?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
      <label htmlFor={htmlFor} style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
        {label}
        {help && <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 400, marginTop: 2 }}>{help}</span>}
      </label>
      {extra}
    </div>
  )
}

export function TextField({
  label, value, onChange, type = 'text', help, placeholder, required, extra, multiline, rows = 3, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; help?: string
  placeholder?: string; required?: boolean; extra?: ReactNode; multiline?: boolean; rows?: number; autoComplete?: string
}) {
  const id = useId()
  return (
    <div>
      <FieldLabel label={label} help={help} htmlFor={id} extra={extra} />
      {multiline ? (
        <textarea id={id} value={value} onChange={e => onChange(e.target.value)} rows={rows}
          placeholder={placeholder} required={required} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
      ) : (
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required} autoComplete={autoComplete} style={inputStyle} />
      )}
    </div>
  )
}

export function SelectField({
  label, value, onChange, options, help,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; help?: string
}) {
  const id = useId()
  return (
    <div>
      <FieldLabel label={label} help={help} htmlFor={id} />
      <select id={id} value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function Toggle({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, marginTop: 2, accentColor: GOLD, cursor: 'pointer', flexShrink: 0 }} />
      <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
        {label}
        {help && <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 400, marginTop: 2 }}>{help}</span>}
      </span>
    </label>
  )
}

/** Image picker: preview, upload button, or paste a web address. */
export function ImageField({
  label, value, onChange, help, folder = 'content', extra,
}: {
  label: string; value: string; onChange: (v: string) => void; help?: string
  folder?: 'content' | 'programs'; extra?: ReactNode
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onChange(await uploadImage(file, folder))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <FieldLabel label={label} help={help} extra={extra} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
          border: '1px solid var(--border)', backgroundColor: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
          backgroundImage: 'repeating-conic-gradient(rgba(128,128,128,0.12) 0% 25%, transparent 0% 50%)',
          backgroundSize: '12px 12px',
        }}>
          {value
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied URL preview
            ? <img src={value} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <IconPhoto size={24} stroke={1.5} />}
        </div>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
              <IconUpload size={15} /> {busy ? 'Uploading…' : 'Upload image'}
            </Button>
            {value && <Button variant="ghost" onClick={() => onChange('')}>Remove</Button>}
          </div>
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="…or paste an image address"
            aria-label={`${label} address`}
            style={{ ...inputStyle, fontSize: 12, padding: '7px 10px' }}
          />
          {error && <span style={{ color: '#f87171', fontSize: 12 }}>{error}</span>}
        </div>
        <input
          ref={fileRef} type="file" hidden
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          onChange={e => onFile(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function Modal({
  title, onClose, children, footer, width = 560,
}: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number
}) {
  useModal(onClose)
  return (
    <div
      {...modalOverlayProps}
      aria-label={title}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16,
        width: '100%', maxWidth: width, maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 700, margin: 0 }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={20} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {children}
        </div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Promise-free confirm with the browser's dialog — enough for destructive one-offs. */
export function confirmAction(message: string): boolean {
  return typeof window !== 'undefined' && window.confirm(message)
}

export function Grid({ children, min = 260 }: { children: ReactNode; min?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`, gap: 16 }}>
      {children}
    </div>
  )
}
