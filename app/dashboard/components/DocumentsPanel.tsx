'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconFileTypePdf, IconTrash, IconExternalLink } from '@tabler/icons-react'
import { toast } from './toast'
import { Card, Button, SelectField, TextField, Badge, ErrorBanner, Loading, confirmAction } from './admin-ui'

type DocType = 'photo' | 'id_card' | 'passport' | 'civil_record' | 'other'

interface Doc {
  id: string
  doc_type: DocType
  label: string
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_by: string | null
  uploaded_at: string
}

const TYPE_LABEL: Record<DocType, string> = {
  photo: 'Photo',
  id_card: 'ID card',
  passport: 'Passport',
  civil_record: 'Civil record',
  other: 'Other document',
}
const TYPE_OPTIONS = (Object.keys(TYPE_LABEL) as DocType[]).map(v => ({ value: v, label: TYPE_LABEL[v] }))
const MAX_BYTES = 4 * 1024 * 1024

const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

/**
 * Photos and legal papers for one student or staff account. Files are private:
 * thumbnails and "Open" links go through /api/documents/<id>/file, which checks
 * who is asking.
 */
export default function DocumentsPanel({
  ownerType, ownerId, meId, isAdmin, canUpload = true,
}: {
  ownerType: 'student' | 'user'
  ownerId: string
  meId: string
  isAdmin: boolean
  canUpload?: boolean
}) {
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [error, setError] = useState('')
  const [docType, setDocType] = useState<DocType>('photo')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Bumped to refetch after an upload or when Retry is pressed.
  const [reloadKey, setReloadKey] = useState(0)
  const load = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/documents?ownerType=${ownerType}&ownerId=${ownerId}`, { cache: "no-store" })
      .then(async res => ({ ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) }))
      .then(({ ok, status, body }) => {
        if (cancelled) return
        if (!ok) { setError(body?.error ?? `Request failed (${status})`); setDocs([]) }
        else { setError(""); setDocs(body.data as Doc[]) }
      })
      .catch(() => { if (!cancelled) { setError("Could not load documents"); setDocs([]) } })
    return () => { cancelled = true }
  }, [ownerType, ownerId, reloadKey])

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    if (file.size > MAX_BYTES) { toast('That file is over 4 MB. Choose a smaller one.', 'error'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('ownerType', ownerType)
      form.set('ownerId', ownerId)
      form.set('docType', docType)
      form.set('label', label)
      const res = await fetch('/api/documents', { method: 'POST', body: form })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? `Upload failed (${res.status})`)
      toast('Uploaded', 'success')
      setFile(null); setLabel('')
      if (fileInput.current) fileInput.current.value = ''
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function remove(d: Doc) {
    if (!confirmAction(`Delete this ${TYPE_LABEL[d.doc_type].toLowerCase()}${d.label ? ` (${d.label})` : ''}? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/documents/${d.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? `Delete failed (${res.status})`)
      setDocs(list => (list ?? []).filter(x => x.id !== d.id))
      toast('Deleted', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {canUpload && (
        <Card>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Add a photo or document</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 14px', lineHeight: 1.5 }}>
            JPG, PNG, WebP or PDF, up to 4 MB. Files are private: only you and the academy administrators can open them.
          </p>
          <form onSubmit={upload} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SelectField label="Type" value={docType} onChange={v => setDocType(v as DocType)} options={TYPE_OPTIONS} />
            <TextField label="Note (optional)" value={label} onChange={setLabel} placeholder="e.g. Front side" />
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              aria-label="Choose file"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ color: 'var(--text-secondary)', fontSize: 13 }}
            />
            <div>
              <Button type="submit" disabled={!file || uploading}>{uploading ? 'Uploading…' : 'Upload'}</Button>
            </div>
          </form>
        </Card>
      )}

      {error && <ErrorBanner message={error} onRetry={load} />}
      {docs === null ? <Loading /> : docs.length === 0 && !error ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Nothing uploaded yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))', gap: 12 }}>
          {docs.map(d => {
            const url = `/api/documents/${d.id}/file`
            const isImage = d.mime_type.startsWith('image/')
            const mayDelete = isAdmin || d.uploaded_by === meId
            return (
              <Card key={d.id} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${d.file_name}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', height: 150, borderRadius: 8,
                  backgroundColor: 'var(--bg)', border: '1px solid var(--border)', overflow: 'hidden', color: 'var(--text-muted)',
                }}>
                  {isImage
                    // eslint-disable-next-line @next/next/no-img-element -- private, cookie-authenticated file; next/image can't send the session cookie to the optimiser
                    ? <img src={url} alt={d.label || TYPE_LABEL[d.doc_type]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <IconFileTypePdf size={44} stroke={1.5} />}
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge>{TYPE_LABEL[d.doc_type]}</Badge>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{size(d.size_bytes)} · {new Date(d.uploaded_at).toLocaleDateString('en-GB')}</span>
                </div>
                {d.label && <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{d.label}</span>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-gold)', fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  }}>
                    <IconExternalLink size={14} /> Open
                  </a>
                  {mayDelete && (
                    <button onClick={() => remove(d)} style={{
                      marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                      color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <IconTrash size={14} /> Delete
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
