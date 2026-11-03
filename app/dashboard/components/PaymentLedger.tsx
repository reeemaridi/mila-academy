'use client'

import { useCallback, useEffect, useState } from 'react'
import { IconTrash, IconPlus } from '@tabler/icons-react'
import { toast } from './toast'
import { Card, Button, Badge, ErrorBanner, Loading, confirmAction } from './admin-ui'

type PeriodType = 'monthly' | 'per_session'
type Status = 'paid' | 'unpaid' | 'partial'
type Method = 'cash' | 'bank' | 'whatsapp'

interface Row {
  id: string
  period_type: PeriodType
  period_label: string
  amount: number
  status: Status
  paid_date: string | null
  method: Method | null
  notes: string
}

const STATUS_LABEL: Record<Status, string> = { paid: 'Paid', unpaid: 'Not paid', partial: 'Partly paid' }
const STATUS_COLOR: Record<Status, string> = { paid: '#16a34a', unpaid: '#ef4444', partial: '#f5c518' }
const METHOD_LABEL: Record<Method, string> = { cash: 'Cash', bank: 'Bank', whatsapp: 'WhatsApp' }

const today = () => new Date().toISOString().slice(0, 10)

/** "2026-06" → "June 2026"; "2026-06-12" → "Fri 12 Jun 2026". */
function formatPeriod(type: PeriodType, label: string): string {
  if (type === 'monthly') {
    const [y, m] = label.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  const [y, m, d] = label.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

const field = {
  width: '100%', padding: '9px 10px', boxSizing: 'border-box' as const, backgroundColor: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
}
const lab = { color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }

/**
 * A student's payments, one record per period: a whole month or a single day
 * (per-session billing), the same way attendance is recorded per day.
 */
export default function PaymentLedger({
  studentId, defaultType, defaultAmount, canEdit,
}: {
  studentId: string
  defaultType: PeriodType
  defaultAmount: number
  canEdit: boolean
}) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  const [type, setType] = useState<PeriodType>(defaultType)
  const [period, setPeriod] = useState(defaultType === 'monthly' ? today().slice(0, 7) : today())
  const [amount, setAmount] = useState(String(defaultAmount ?? 0))
  const [status, setStatus] = useState<Status>('paid')
  const [method, setMethod] = useState<Method>('cash')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/payments?student_id=${studentId}`, { cache: 'no-store' })
      .then(async res => ({ ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) }))
      .then(({ ok, status: code, body }) => {
        if (cancelled) return
        if (!ok) { setError(body?.error ?? `Request failed (${code})`); setRows([]) }
        else { setError(''); setRows(body.data as Row[]) }
      })
      .catch(() => { if (!cancelled) { setError('Could not load payments'); setRows([]) } })
    return () => { cancelled = true }
  }, [studentId, reloadKey])

  function changeType(t: PeriodType) {
    setType(t)
    setPeriod(t === 'monthly' ? today().slice(0, 7) : today())
  }

  async function send(url: string, method_: 'POST' | 'PATCH' | 'DELETE', json?: unknown): Promise<Row | null> {
    const res = await fetch(url, {
      method: method_,
      headers: json ? { 'Content-Type': 'application/json' } : undefined,
      body: json ? JSON.stringify(json) : undefined,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
    return (body.data as Row) ?? null
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!period || amount.trim() === '' || !Number.isFinite(n) || n < 0) { toast('Enter a period and an amount of 0 or more.', 'error'); return }
    setSaving(true)
    try {
      await send('/api/admin/payments', 'POST', {
        student_id: studentId, period_type: type, period_label: period, amount: n, status,
        method: status === 'unpaid' ? null : method,
      })
      toast('Payment recorded', 'success')
      reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function update(r: Row, patch: Partial<Pick<Row, 'status' | 'method' | 'amount'>>) {
    try {
      const updated = await send(`/api/admin/payments/${r.id}`, 'PATCH', patch)
      if (updated) setRows(list => (list ?? []).map(x => (x.id === r.id ? updated : x)))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error')
    }
  }

  async function remove(r: Row) {
    if (!confirmAction(`Delete the payment for ${formatPeriod(r.period_type, r.period_label)}? This cannot be undone.`)) return
    try {
      await send(`/api/admin/payments/${r.id}`, 'DELETE')
      setRows(list => (list ?? []).filter(x => x.id !== r.id))
      toast('Deleted', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete', 'error')
    }
  }

  const list = rows ?? []
  const paidTotal = list.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0)
  const owed = list.filter(r => r.status !== 'paid')
  const owedTotal = owed.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <Card style={{ padding: 20 }}>
      <p style={{ color: '#f5c518', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 4px' }}>
        Payment records
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 16px', lineHeight: 1.5 }}>
        One record per month (monthly billing) or per day (per-session billing), like attendance.
      </p>

      {canEdit && (
        <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, alignItems: 'end', marginBottom: 18 }}>
          <div>
            <label style={lab} htmlFor="led-type">Billing</label>
            <select id="led-type" value={type} onChange={e => changeType(e.target.value as PeriodType)} style={field}>
              <option value="monthly">Monthly</option>
              <option value="per_session">Daily (per session)</option>
            </select>
          </div>
          <div>
            <label style={lab} htmlFor="led-period">{type === 'monthly' ? 'Month' : 'Day'}</label>
            <input id="led-period" type={type === 'monthly' ? 'month' : 'date'} value={period} onChange={e => setPeriod(e.target.value)} style={field} required />
          </div>
          <div>
            <label style={lab} htmlFor="led-amount">Amount ($)</label>
            <input id="led-amount" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={field} required />
          </div>
          <div>
            <label style={lab} htmlFor="led-status">Status</label>
            <select id="led-status" value={status} onChange={e => setStatus(e.target.value as Status)} style={field}>
              <option value="paid">Paid</option>
              <option value="unpaid">Not paid</option>
              <option value="partial">Partly paid</option>
            </select>
          </div>
          {status !== 'unpaid' && (
            <div>
              <label style={lab} htmlFor="led-method">Method</label>
              <select id="led-method" value={method} onChange={e => setMethod(e.target.value as Method)} style={field}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
          )}
          <Button type="submit" disabled={saving}><IconPlus size={14} /> {saving ? 'Saving…' : 'Add'}</Button>
        </form>
      )}

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {rows === null ? <Loading /> : (
        <>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Paid: <strong style={{ color: '#16a34a' }}>${paidTotal}</strong></span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Still owed: <strong style={{ color: owed.length ? '#ef4444' : 'var(--text-primary)' }}>${owedTotal}</strong> ({owed.length})</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Records: <strong style={{ color: 'var(--text-primary)' }}>{list.length}</strong></span>
          </div>

          {list.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No payments recorded yet.</p>
          ) : (
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                <thead>
                  <tr>
                    {['Period', 'Amount', 'Status', 'Method', 'Paid on', ''].map(h => (
                      <th key={h} style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', padding: '0 8px 10px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => (
                    <tr key={r.id}>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13 }}>
                        {formatPeriod(r.period_type, r.period_label)}{' '}
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.period_type === 'monthly' ? '· month' : '· day'}</span>
                      </td>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>${Number(r.amount)}</td>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
                        {canEdit ? (
                          <select value={r.status} onChange={e => update(r, { status: e.target.value as Status })} aria-label="Status" style={{ ...field, width: 'auto', padding: '5px 8px', color: STATUS_COLOR[r.status], fontWeight: 700 }}>
                            <option value="paid">Paid</option>
                            <option value="unpaid">Not paid</option>
                            <option value="partial">Partly paid</option>
                          </select>
                        ) : <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>}
                      </td>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>{r.method ? METHOD_LABEL[r.method] : '—'}</td>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{r.paid_date ?? '—'}</td>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
                        {canEdit && (
                          <button onClick={() => remove(r)} aria-label="Delete payment" title="Delete" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }}>
                            <IconTrash size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
