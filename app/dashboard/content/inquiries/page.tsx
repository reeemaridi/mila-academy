'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconTrash, IconCheck, IconArrowBackUp, IconBrandWhatsapp, IconMail, IconPhone, IconUserPlus } from '@tabler/icons-react'
import { ENQUIRY_PREFILL_KEY, type EnquiryPrefill } from '../../students/enquiry-prefill'
import { useRequireAccess } from '../../hooks/useRequireAccess'
import { toast } from '../../components/toast'
import {
  api, useAdminData, PageHeader, Card, Button, Loading, ErrorBanner, EmptyState, Badge, confirmAction,
} from '../../components/admin-ui'

interface Inquiry {
  id: string
  name: string
  email: string
  phone: string
  child_age: number | null
  academy: string
  message: string | null
  handled: boolean
  created_at: string
}

const ACADEMY_LABEL: Record<string, { label: string; color: string }> = {
  mfa: { label: 'Football', color: '#16a34a' },
  mba: { label: 'Basketball', color: '#f97316' },
}

const linkStyle = { color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 } as const

export default function InquiriesAdminPage() {
  const { user, loading: guardLoading } = useRequireAccess('website')
  const { data: rows, setData: setRows, loading, error, reload: load } =
    useAdminData<Inquiry[]>('/api/admin/inquiries', !!user, [])
  const [view, setView] = useState<'open' | 'handled' | 'all'>('open')
  const router = useRouter()


  const shown = useMemo(
    () => rows.filter(r => view === 'all' || (view === 'handled' ? r.handled : !r.handled)),
    [rows, view],
  )
  const openCount = rows.filter(r => !r.handled).length

  async function setHandled(r: Inquiry, handled: boolean) {
    setRows(list => list.map(x => (x.id === r.id ? { ...x, handled } : x)))
    try {
      await api(`/api/admin/inquiries/${r.id}`, { method: 'PATCH', json: { handled } })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Update failed', 'error')
      load()
    }
  }

  // Hand the enquiry to the Add Student form (opened on the Students page) so
  // nothing has to be retyped.
  function createStudent(r: Inquiry) {
    const prefill: EnquiryPrefill = {
      inquiryId: r.id,
      contactName: r.name,
      email: r.email,
      phone: r.phone,
      academy: r.academy === 'mba' ? 'MBA' : 'MFA',
      childAge: r.child_age,
      message: r.message ?? '',
    }
    try { sessionStorage.setItem(ENQUIRY_PREFILL_KEY, JSON.stringify(prefill)) } catch {}
    router.push('/dashboard/students')
  }

  async function remove(r: Inquiry) {
    if (!confirmAction(`Delete the inquiry from ${r.name}? This cannot be undone.`)) return
    try {
      await api(`/api/admin/inquiries/${r.id}`, { method: 'DELETE' })
      setRows(list => list.filter(x => x.id !== r.id))
      toast('Inquiry deleted', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error')
    }
  }

  if (guardLoading || !user) return null

  return (
    <div>
      <PageHeader
        title="Inquiries"
        subtitle="Sign-up requests sent through the enquiry form on the website. Mark them handled once you've followed up."
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {([['open', `To follow up (${openCount})`], ['handled', 'Handled'], ['all', `All (${rows.length})`]] as const).map(([k, label]) => (
          <Button key={k} variant={view === k ? 'primary' : 'secondary'} onClick={() => setView(k)} style={{ minHeight: 32, padding: '6px 14px' }}>
            {label}
          </Button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? <Loading /> : shown.length === 0 ? (
        <EmptyState>{view === 'open' ? 'Nothing to follow up — you’re all caught up.' : 'No inquiries here.'}</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(r => {
            const ac = ACADEMY_LABEL[r.academy]
            const phoneDigits = r.phone.replace(/\D/g, '')
            return (
              <Card key={r.id} style={{ opacity: r.handled ? 0.65 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>{r.name}</span>
                      {ac && <Badge color={ac.color}>{ac.label}</Badge>}
                      {r.child_age != null && <Badge color="#888888">Age {r.child_age}</Badge>}
                      {r.handled && <Badge color="#16a34a">Handled</Badge>}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '4px 0 10px' }}>
                      {new Date(r.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <a href={`mailto:${r.email}`} style={linkStyle}><IconMail size={15} /> {r.email}</a>
                      {r.phone && <a href={`tel:${r.phone}`} style={linkStyle}><IconPhone size={15} /> {r.phone}</a>}
                      {phoneDigits.length >= 6 && (
                        <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, color: '#25D366' }}>
                          <IconBrandWhatsapp size={15} /> WhatsApp
                        </a>
                      )}
                    </div>
                    {r.message && (
                      <p style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6, margin: '12px 0 0', whiteSpace: 'pre-wrap' }}>{r.message}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    {!r.handled && <Button onClick={() => createStudent(r)} title="Open the Add Student form with this enquiry filled in"><IconUserPlus size={14} /> Create student</Button>}
                    {r.handled
                      ? <Button variant="secondary" onClick={() => setHandled(r, false)}><IconArrowBackUp size={14} /> Reopen</Button>
                      : <Button variant="secondary" onClick={() => setHandled(r, true)}><IconCheck size={14} /> Mark handled</Button>}
                    <Button variant="danger" onClick={() => remove(r)} title="Delete"><IconTrash size={14} /></Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
