'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  IconCheck, IconX, IconFilter, IconChevronDown, IconCalendar,
} from '@tabler/icons-react'
import { useRequireAccess } from '../hooks/useRequireAccess'
import { useSelectedAcademy, useSession } from '@/lib/use-session'
import { toast } from '../components/toast'
import { useModal, modalOverlayProps } from '../hooks/useModal'
import { useRoster } from '../hooks/useRoster'
import {
  TEAMS, loadAllStudents, generatePayments, teamName,
  type StudentRow, type PaymentEntry,
  PAYMENT_MONTHS, CURRENT_PAYMENT_MONTH,
} from '../students/data'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PaymentUpdate extends Partial<PaymentEntry> { notes?: string }
interface PaymentOverride { [key: string]: PaymentUpdate }

interface HistoryEntry extends PaymentEntry {
  student_id: string
  student_name: string
  team_name: string
  academy: 'MFA' | 'MBA'
  recorded_by: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  paid:    { label: 'Paid',    color: '#16a34a', bg: 'rgba(22,163,74,0.12)'  },
  partial: { label: 'Partial', color: '#f5c518', bg: 'rgba(245,197,24,0.12)' },
  unpaid:  { label: 'Unpaid',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(n: string) {
  return n.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

function acColor(teamId: string) {
  return TEAMS.find(t => t.id === teamId)?.academy === 'MBA' ? '#f97316' : '#16a34a'
}

function ovKey(sid: string, month: string) { return `${sid}__${month}` }

function paymentForMonth(student: StudentRow, month: string, overrides: PaymentOverride): PaymentEntry {
  const base = generatePayments(student.id, student.payment_status).find(p => p.month === month)
    ?? { id: `x-${student.id}`, month, amount: 150, status: 'unpaid' as const, paid_date: '', method: '' as const }
  const ov = overrides[ovKey(student.id, month)]
  return ov ? { ...base, ...ov as Partial<PaymentEntry> } : base
}

function sendWhatsApp(student: StudentRow, month: string) {
  // Without a number this opens https://wa.me/?text=... — a WhatsApp error page
  // with the message lost. Tell the user what's missing instead.
  if (!student.parent_whatsapp) {
    toast(`No WhatsApp number on file for ${student.parent_name}`, 'error')
    return
  }
  const text = encodeURIComponent(
    `Dear ${student.parent_name}, this is a friendly reminder that ${student.name}'s monthly fee of $150 for ${month} is due on ${student.payment_due_date}. Please arrange payment at your earliest convenience.\n\nThank you,\nMila Academy`
  )
  window.open(`https://wa.me/${student.parent_whatsapp}?text=${text}`, '_blank')
}

async function generateReceipt(student: StudentRow, payment: PaymentEntry) {
  const jsPDF = (await import('jspdf')).jsPDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()

  // — Dark header band
  doc.setFillColor(10, 10, 10)
  doc.rect(0, 0, W, 48, 'F')

  doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(245, 197, 24)
  doc.text('MILA ACADEMY', W / 2, 20, { align: 'center' })

  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 140, 140)
  doc.text('MFA · MBA · Baissour, Lebanon', W / 2, 29, { align: 'center' })
  doc.text('+961 70 000 000  ·  info@milaacademy.com', W / 2, 35, { align: 'center' })

  // — Title
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 20)
  doc.text('PAYMENT RECEIPT', W / 2, 60, { align: 'center' })

  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3)
  doc.line(20, 64, W - 20, 64)

  // — Receipt meta
  const receiptNo = `MLA-${student.id.padStart(4, '0')}-${Date.now().toString().slice(-5)}`
  const issueDate = payment.paid_date || new Date().toISOString().split('T')[0]

  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80)
  doc.text(`Receipt No: ${receiptNo}`, 20, 74)
  doc.text(`Issue Date: ${issueDate}`, W - 20, 74, { align: 'right' })

  // — Student info box
  doc.setFillColor(248, 248, 248); doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3)
  doc.roundedRect(20, 80, W - 40, 38, 3, 3, 'FD')

  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(110, 110, 110)
  doc.text('STUDENT INFORMATION', 26, 89)

  doc.setFontSize(10); doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'normal'); doc.text('Name:',    26, 98); doc.setFont('helvetica', 'bold'); doc.text(student.name, 48, 98)
  doc.setFont('helvetica', 'normal'); doc.text('Team:',    26, 107); doc.setFont('helvetica', 'bold'); doc.text(teamName(student.team_id), 48, 107)
  doc.setFont('helvetica', 'normal'); doc.text('Academy:', 120, 98);  doc.setFont('helvetica', 'bold'); doc.text(student.academy, 142, 98)
  doc.setFont('helvetica', 'normal'); doc.text('Jersey:',  120, 107); doc.setFont('helvetica', 'bold'); doc.text(`#${student.jersey_number}`, 142, 107)

  // — Payment details
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(110, 110, 110)
  doc.text('PAYMENT DETAILS', 20, 130)
  doc.setDrawColor(200, 200, 200); doc.line(20, 133, W - 20, 133)

  const rows: [string, string][] = [
    ['Payment Month',   payment.month],
    ['Amount',          `$${payment.amount}`],
    ['Payment Method',  payment.method ? payment.method.charAt(0).toUpperCase() + payment.method.slice(1) : '—'],
    ['Date Paid',       payment.paid_date || '—'],
  ]
  doc.setFontSize(10)
  rows.forEach(([label, value], i) => {
    const y = 143 + i * 10
    doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 90, 90); doc.text(`${label}:`, 20, y)
    doc.setFont('helvetica', 'bold');   doc.setTextColor(20, 20, 20); doc.text(value, 80, y)
  })

  // — PAID stamp box
  if (payment.status === 'paid') {
    doc.setDrawColor(22, 163, 74); doc.setLineWidth(2)
    doc.roundedRect(W - 85, 133, 62, 24, 4, 4)
    doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74)
    doc.text('PAID', W - 54, 149, { align: 'center' })
  }

  // — Total band
  doc.setFillColor(10, 10, 10)
  doc.rect(20, 196, W - 40, 20, 'F')
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(245, 197, 24)
  doc.text('TOTAL AMOUNT PAID', 28, 209)
  doc.setTextColor(255, 255, 255)
  doc.text(`$${payment.amount}`, W - 28, 209, { align: 'right' })

  // — Footer
  doc.setDrawColor(200, 200, 200); doc.line(20, 258, W - 20, 258)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150)
  doc.text('This is an official receipt from Mila Football Academy & Mila Basket Academy.', W / 2, 265, { align: 'center' })
  doc.text('Thank you for supporting our athletes.  |  www.milaacademy.com', W / 2, 271, { align: 'center' })

  doc.save(`Receipt_${student.name.replace(/\s+/g, '_')}_${payment.month.replace(/\s+/g, '_')}.pdf`)
}

async function exportToExcel(rows: Array<{ student: StudentRow; payment: PaymentEntry }>, month: string) {
  const XLSX = await import('xlsx')
  const data = rows.map(r => ({
    'Student Name':   r.student.name,
    'Team':           teamName(r.student.team_id),
    'Academy':        r.student.academy,
    'Month':          month,
    'Status':         r.payment.status.charAt(0).toUpperCase() + r.payment.status.slice(1),
    'Amount Paid ($)': r.payment.status !== 'unpaid' ? r.payment.amount : 0,
    'Due Date':       r.student.payment_due_date,
    'Paid Date':      r.payment.paid_date || '—',
    'Method':         r.payment.method || '—',
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Payments')
  XLSX.writeFile(wb, `Mila_Payments_${month.replace(/\s+/g, '_')}.xlsx`)
}

// ── Shared UI pieces ───────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, ...style }}>
      {children}
    </div>
  )
}

const FIELD: React.CSSProperties = {
  width: '100%', backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8,
  color: 'var(--text-secondary)', fontSize: 13, padding: '10px 12px', outline: 'none',
  boxSizing: 'border-box', colorScheme: 'dark',
}
const SEL: React.CSSProperties = {
  ...FIELD, appearance: 'none', cursor: 'pointer', paddingRight: 32,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 010 1.659l-4.796 5.48a1 1 0 01-1.506 0z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '11px',
}
const LBL: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 5 }

// ── Mark Paid Modal ───────────────────────────────────────────────────────────

function MarkPaidModal({
  student, month, current, onSave, onClose,
}: {
  student: StudentRow
  month: string
  current: PaymentEntry
  onSave: (u: PaymentUpdate) => void
  onClose: () => void
}) {
  const [amount,    setAmount]    = useState(String(current.amount))
  const [paidDate,  setPaidDate]  = useState(new Date().toISOString().split('T')[0])
  const [method,    setMethod]    = useState<PaymentEntry['method']>(current.method || 'cash')
  const [notes,     setNotes]     = useState('')

  useModal(onClose)

  return (
    <div
      {...modalOverlayProps}
      aria-label={`Record payment for ${student.name}`}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 460, padding: 'clamp(18px, 5vw, 28px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 700, margin: '0 0 2px' }}>Mark as Paid</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>{student.name} · {month}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={20} /></button>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={LBL}>AMOUNT ($)</label>
            <input type="number" style={FIELD} value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label style={LBL}>DATE PAID</label>
            <input type="date" style={FIELD} value={paidDate} onChange={e => setPaidDate(e.target.value)} />
          </div>
          <div>
            <label style={LBL}>PAYMENT METHOD</label>
            <select style={SEL} value={method} onChange={e => setMethod(e.target.value as PaymentEntry['method'])}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="whatsapp">WhatsApp Pay</option>
            </select>
          </div>
          <div>
            <label style={LBL}>NOTES (optional)</label>
            <textarea rows={2} style={{ ...FIELD, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Paid via family member…" />
          </div>
          <button
            onClick={() => onSave({ status: 'paid', amount: Number(amount) || 150, paid_date: paidDate, method, notes })}
            style={{ width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700, backgroundColor: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <IconCheck size={15} /> Confirm Payment
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Payments Page ──────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { user: authUser, loading: authLoading } = useRequireAccess('payments')
  const rosterVersion = useRoster()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const students = useMemo<StudentRow[]>(() => loadAllStudents(), [rosterVersion])
  const [overrides,     setOverrides]     = useState<PaymentOverride>(() => {
    try {
      return JSON.parse(localStorage.getItem('mila_payment_overrides') ?? '{}')
    } catch {
      return {}
    }
  })
  const { user: session } = useSession()
  const selectedAcademy = useSelectedAcademy()
  // From the session store rather than a raw localStorage read in a useState
  // initialiser, which ran on the server and always froze this to 'Admin'.
  const recordedBy = session?.name ?? 'Admin'
  const [selectedMonth, setSelectedMonth] = useState<string>(CURRENT_PAYMENT_MONTH)

  // Filters. The academy filter follows the sidebar switcher unless the user
  // picks something else here; it used to be seeded from localStorage in the
  // initialiser, which runs on the server too and so always prerendered 'All'.
  const [fAcademyOverride, setFAcademy] = useState<string | null>(null)
  const fAcademy = fAcademyOverride ?? (selectedAcademy === 'Both' ? 'All' : selectedAcademy)
  const [fTeam,    setFTeam]    = useState('All')
  const [fStatus,  setFStatus]  = useState('All')

  useEffect(() => {
    function onAcademyChange() {
      // Switching academy in the sidebar clears any local override.
      setFAcademy(null)
    }
    window.addEventListener('mila_academy_changed', onAcademyChange)
    return () => window.removeEventListener('mila_academy_changed', onAcademyChange)
  }, [])

  // Sort
  const [sortCol, setSortCol] = useState<'name' | 'status' | 'amount'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Modals / UI
  const [markPaidTarget, setMarkPaidTarget] = useState<StudentRow | null>(null)
  const [histOpen,       setHistOpen]       = useState(true)

  function persist(next: PaymentOverride) {
    setOverrides(next)
    try { localStorage.setItem('mila_payment_overrides', JSON.stringify(next)) } catch {}
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const allRows = useMemo(() =>
    students.map(s => ({ student: s, payment: paymentForMonth(s, selectedMonth, overrides) })),
    [students, selectedMonth, overrides]
  )

  const filteredRows = useMemo(() => {
    let r = allRows.filter(({ student, payment }) => {
      if (fAcademy !== 'All' && student.academy !== fAcademy) return false
      if (fTeam    !== 'All' && student.team_id !== fTeam)    return false
      if (fStatus  !== 'All' && payment.status  !== fStatus)  return false
      return true
    })
    r = [...r].sort((a, b) => {
      let c = 0
      if (sortCol === 'name')   c = a.student.name.localeCompare(b.student.name)
      if (sortCol === 'status') c = a.payment.status.localeCompare(b.payment.status)
      if (sortCol === 'amount') c = a.payment.amount - b.payment.amount
      return sortDir === 'asc' ? c : -c
    })
    return r
  }, [allRows, fAcademy, fTeam, fStatus, sortCol, sortDir])

  const stats = useMemo(() => {
    const paid    = allRows.filter(r => r.payment.status === 'paid')
    const partial = allRows.filter(r => r.payment.status === 'partial')
    const unpaid  = allRows.filter(r => r.payment.status === 'unpaid')
    return {
      collected:  paid.reduce((s, r) => s + r.payment.amount, 0) + partial.reduce((s, r) => s + r.payment.amount, 0),
      outstanding: unpaid.reduce((s) => s + 150, 0) + partial.reduce((s, r) => s + (150 - r.payment.amount), 0),
      paid:    paid.length,
      unpaid:  unpaid.length,
    }
  }, [allRows])

  const history = useMemo<HistoryEntry[]>(() => {
    const out: HistoryEntry[] = []
    students.forEach(s => {
      generatePayments(s.id, s.payment_status).forEach(p => {
        const ov = overrides[ovKey(s.id, p.month)]
        const merged: PaymentEntry = ov ? { ...p, ...(ov as Partial<PaymentEntry>) } : p
        if (merged.status !== 'unpaid' && merged.paid_date) {
          out.push({ ...merged, student_id: s.id, student_name: s.name, team_name: teamName(s.team_id), academy: s.academy, recorded_by: recordedBy })
        }
      })
    })
    return out.sort((a, b) => b.paid_date.localeCompare(a.paid_date))
  }, [students, overrides, recordedBy])

  // ── Sort helpers ─────────────────────────────────────────────────────────────
  function clickSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function SortIndicator({ col }: { col: typeof sortCol }) {
    return <span style={{ marginLeft: 3, fontSize: 9, color: sortCol === col ? '#f5c518' : 'var(--text-muted)' }}>{sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
  }

  const filterSel: React.CSSProperties = { ...SEL, fontSize: 12 }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (authLoading || !authUser) return null
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        .pay-stats { display: grid; grid-template-columns: repeat(4,minmax(0, 1fr)); gap: 14px; }
        @media (max-width: 860px) { .pay-stats { grid-template-columns: repeat(2,minmax(0, 1fr)); } }
        .pay-tr:hover td { background: rgba(255,255,255,0.02) !important; }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Payments</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Track and manage student fees across all teams.</p>
        </div>
        <button
          onClick={() => {
            // The export is async and was called bare: a failure (e.g. the xlsx
            // chunk failing to load) rejected unhandled and the button appeared
            // to simply do nothing.
            exportToExcel(filteredRows, selectedMonth)
              .catch(() => toast('Could not build the Excel export', 'error'))
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          ↓ Export Excel
        </button>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="pay-stats" style={{ marginBottom: 24 }}>
        {[
          { label: 'Collected',    sub: selectedMonth,  val: `$${stats.collected}`,  icon: '💰', color: '#16a34a', bg: 'rgba(22,163,74,0.12)'  },
          { label: 'Outstanding',  sub: selectedMonth,  val: `$${stats.outstanding}`, icon: '⏳', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
          { label: 'Fully Paid',   sub: 'students',     val: stats.paid,              icon: '✅', color: '#16a34a', bg: 'rgba(22,163,74,0.12)'  },
          { label: 'Unpaid',       sub: 'students',     val: stats.unpaid,            icon: '⚠️',  color: '#f5c518', bg: 'rgba(245,197,24,0.12)' },
        ].map(s => (
          <Card key={s.label} style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>{s.label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                {s.icon}
              </div>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: 30, fontWeight: 800, margin: '0 0 2px', letterSpacing: '-0.5px' }}>{s.val}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <Card style={{ padding: '13px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 12 }}>
            <IconFilter size={13} /> Filter:
          </span>

          {/* Month selector */}
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={filterSel}>
            {PAYMENT_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Academy */}
          <select value={fAcademy} onChange={e => setFAcademy(e.target.value)} style={filterSel}>
            <option value="All">All Academies</option>
            <option value="MFA">MFA</option>
            <option value="MBA">MBA</option>
          </select>

          {/* Team */}
          <select value={fTeam} onChange={e => setFTeam(e.target.value)} style={filterSel}>
            <option value="All">All Teams</option>
            {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {/* Status */}
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={filterSel}>
            <option value="All">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>

          {/* Sort buttons */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sort:</span>
            {(['name', 'status', 'amount'] as const).map(col => (
              <button key={col} onClick={() => clickSort(col)} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `0.5px solid ${sortCol === col ? '#f5c518' : 'var(--border)'}`,
                backgroundColor: sortCol === col ? 'rgba(245,197,24,0.1)' : 'var(--bg-card)',
                color: sortCol === col ? '#f5c518' : 'var(--text-muted)',
                textTransform: 'capitalize',
              }}>
                {col} <SortIndicator col={col} />
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Payments table ───────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: 0 }}>
            {filteredRows.length} students
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13, marginLeft: 8 }}>— {selectedMonth}</span>
          </h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                {['Student', 'Team', 'Academy', 'Status', 'Amount', 'Due Date', 'Actions'].map(h => (
                  <th key={h} style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', padding: '10px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ student, payment }) => {
                const cfg = STATUS_CFG[payment.status]
                const col = acColor(student.team_id)
                return (
                  <tr key={student.id} className="pay-tr">
                    {/* Student */}
                    <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, backgroundColor: `${col}1a`, border: `1.5px solid ${col}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: col, fontSize: 11, fontWeight: 700 }}>
                          {initials(student.name)}
                        </div>
                        <div>
                          <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: 0 }}>{student.name}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>#{student.jersey_number}</p>
                        </div>
                      </div>
                    </td>

                    {/* Team */}
                    <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                      <span style={{ color: col, fontSize: 12, fontWeight: 600 }}>{teamName(student.team_id)}</span>
                    </td>

                    {/* Academy */}
                    <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: `${col}1a`, color: col }}>
                        {student.academy}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                      <span style={{ color: payment.status !== 'unpaid' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
                        {payment.status === 'unpaid' ? '—' : `$${payment.amount}`}
                      </span>
                    </td>

                    {/* Due date */}
                    <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{student.payment_due_date}</span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                        {authUser?.role === 'admin' && payment.status !== 'paid' && (
                          <button onClick={() => setMarkPaidTarget(student)} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: 'rgba(22,163,74,0.12)', border: '0.5px solid rgba(22,163,74,0.3)', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <IconCheck size={12} /> Mark Paid
                          </button>
                        )}
                        {payment.status === 'paid' && (
                          <button onClick={() => { generateReceipt(student, payment).catch(() => toast('Could not build the receipt PDF', 'error')) }} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,197,24,0.1)', border: '0.5px solid rgba(245,197,24,0.3)', color: '#f5c518', fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            🧾 Receipt
                          </button>
                        )}
                        {authUser?.role === 'admin' && <button onClick={() => sendWhatsApp(student, selectedMonth)} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: 'rgba(37,211,102,0.1)', border: '0.5px solid rgba(37,211,102,0.25)', color: '#25D366', fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          💬 Remind
                        </button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                    No students match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Payment history ───────────────────────────────────────────────── */}
      <Card style={{ padding: '20px 24px' }}>
        <div
          onClick={() => setHistOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: histOpen ? 20 : 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconCalendar size={17} style={{ color: '#f5c518' }} />
            <h2 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, margin: 0 }}>
              Payment History
              <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>({history.length} records)</span>
            </h2>
          </div>
          <IconChevronDown size={18} style={{ color: 'var(--text-muted)', transform: histOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </div>

        {histOpen && (
          history.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '28px 0' }}>No payment records yet.</p>
            : <div>
                {history.map((entry, i) => {
                  const col = entry.academy === 'MBA' ? '#f97316' : '#16a34a'
                  const cfg = STATUS_CFG[entry.status]
                  return (
                    <div key={`${entry.student_id}-${entry.month}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      {/* Timeline dot + line */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color, border: `2px solid ${cfg.bg}`, flexShrink: 0 }} />
                        {i < history.length - 1 && <div style={{ width: 1, height: 22, backgroundColor: 'var(--border)', marginTop: 3 }} />}
                      </div>

                      {/* Avatar */}
                      <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, backgroundColor: `${col}1a`, border: `1.5px solid ${col}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: col, fontSize: 10, fontWeight: 700 }}>
                        {initials(entry.student_name)}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: '0 0 1px' }}>{entry.student_name}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>{entry.team_name} · {entry.month}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ color: '#16a34a', fontSize: 14, fontWeight: 700, margin: '0 0 1px' }}>${entry.amount}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0, textTransform: 'capitalize' }}>{entry.method || '—'}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '0 0 1px' }}>{entry.paid_date}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>by {entry.recorded_by}</p>
                          </div>
                          <span style={{ backgroundColor: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
        )}
      </Card>

      {/* ── Mark Paid Modal ───────────────────────────────────────────────── */}
      {markPaidTarget && (
        <MarkPaidModal
          student={markPaidTarget}
          month={selectedMonth}
          current={paymentForMonth(markPaidTarget, selectedMonth, overrides)}
          onSave={update => {
            const next = { ...overrides, [ovKey(markPaidTarget.id, selectedMonth)]: update }
            persist(next)
            setMarkPaidTarget(null)
          }}
          onClose={() => setMarkPaidTarget(null)}
        />
      )}
    </div>
  )
}
