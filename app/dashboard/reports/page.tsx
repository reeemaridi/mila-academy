'use client'

import { useRoster } from '../hooks/useRoster'
import { useState } from 'react'
import { IconChartBar, IconCheck } from '@tabler/icons-react'
import {
  TEAMS, loadAllStudents, generatePayments, generateAttendance, generateRatings, teamName,
  CURRENT_PAYMENT_MONTH,
} from '../students/data'
import { toast } from '../components/toast'
import { useRequireAccess } from '../hooks/useRequireAccess'

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getPDF() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}
async function getAutoTable() {
  return (await import('jspdf-autotable')).default
}

function pdfHeader(doc: InstanceType<Awaited<ReturnType<typeof getPDF>>>, title: string, subtitle: string) {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(10, 10, 10)
  doc.rect(0, 0, W, 36, 'F')
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(245, 197, 24)
  doc.text('MILA ACADEMY', W / 2, 16, { align: 'center' })
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 140, 140)
  doc.text('Baissour, Lebanon  ·  info@milaacademy.com', W / 2, 23, { align: 'center' })
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 20)
  doc.text(title, W / 2, 46, { align: 'center' })
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120)
  doc.text(subtitle, W / 2, 53, { align: 'center' })
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3)
  doc.line(15, 57, W - 15, 57)
}

// ── Report 1: Monthly Attendance PDF ──────────────────────────────────────────

async function generateAttendancePDF() {
  const jsPDF  = await getPDF()
  const autoTable = await getAutoTable()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const students = loadAllStudents()
  const month = CURRENT_PAYMENT_MONTH

  pdfHeader(doc, `Monthly Attendance Report — ${month}`, `Generated ${new Date().toLocaleDateString('en-GB')}`)

  const head = [['Student', 'Team', 'Sessions', 'Present', 'Late', 'Absent', 'Rate %']]
  const body = students.map(s => {
    const att  = generateAttendance(s.id, s.attendance_rate)
    const pres = att.filter(a => a.status === 'present').length
    const late = att.filter(a => a.status === 'late').length
    const abs  = att.filter(a => a.status === 'absent').length
    // att.length is 0 for a student with no sessions logged; without the guard
    // this divides by zero and the report prints "NaN%".
    const rate = att.length ? Math.round(((pres + late) / att.length) * 100) : 0
    return [s.name, teamName(s.team_id), att.length, pres, late, abs, `${rate}%`]
  })

  autoTable(doc, {
    head, body,
    startY: 62,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [10, 10, 10], textColor: [245, 197, 24], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 6: { textColor: [22, 163, 74], fontStyle: 'bold' } },
  })

  doc.save(`Mila_Attendance_${month.replace(' ', '_')}.pdf`)
}

// ── Report 2: Payment Report Excel ────────────────────────────────────────────

async function generatePaymentExcel() {
  const XLSX = await import('xlsx')
  const students = loadAllStudents()
  const month = CURRENT_PAYMENT_MONTH

  const rows = students.map(s => {
    const payments = generatePayments(s.id, s.payment_status)
    const p = payments.find(x => x.month === month) ?? payments[payments.length - 1]
    return {
      'Student Name':    s.name,
      'Team':            teamName(s.team_id),
      'Academy':         s.academy,
      'Month':           month,
      'Status':          p.status.charAt(0).toUpperCase() + p.status.slice(1),
      'Amount Paid ($)': p.status !== 'unpaid' ? p.amount : 0,
      'Outstanding ($)': p.status === 'unpaid' ? 150 : p.status === 'partial' ? 150 - p.amount : 0,
      'Due Date':        s.payment_due_date,
      'Method':          p.method || '—',
      'Paid Date':       p.paid_date || '—',
    }
  })

  // Summary rows
  const paid    = rows.filter(r => r['Status'] === 'Paid').length
  const unpaid  = rows.filter(r => r['Status'] === 'Unpaid').length
  const partial = rows.filter(r => r['Status'] === 'Partial').length
  const totalCol = rows.reduce((s, r) => s + r['Amount Paid ($)'], 0)

  const ws = XLSX.utils.json_to_sheet([
    ...rows,
    {},
    { 'Student Name': 'SUMMARY', 'Status': '', 'Amount Paid ($)': '' },
    { 'Student Name': 'Total Paid', 'Status': paid, 'Amount Paid ($)': `$${totalCol}` },
    { 'Student Name': 'Unpaid',     'Status': unpaid  },
    { 'Student Name': 'Partial',    'Status': partial },
  ] as object[])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, month)
  XLSX.writeFile(wb, `Mila_Payments_${month.replace(' ', '_')}.xlsx`)
}

// ── Report 3: Player Progress PDF ─────────────────────────────────────────────

async function generateProgressPDF() {
  const jsPDF     = await getPDF()
  const autoTable = await getAutoTable()
  const students  = loadAllStudents()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  students.forEach((s, idx) => {
    if (idx > 0) doc.addPage()

    pdfHeader(doc, `Player Progress Report — ${s.name}`, `${teamName(s.team_id)}  ·  #${s.jersey_number}  ·  ${s.position}`)

    const ratings = generateRatings(s.id, s.overall_rating)
    const head = [['Date', 'Coach', 'Technique', 'Fitness', 'Attitude', 'Teamwork', 'Overall', 'Notes']]
    const body = ratings.map(r => [r.date, r.coach, r.technique, r.fitness, r.attitude, r.teamwork, r.overall, r.notes || '—'])

    autoTable(doc, {
      head, body,
      startY: 62,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [10, 10, 10], textColor: [245, 197, 24], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 6: { textColor: [22, 163, 74], fontStyle: 'bold' } },
    })

    // Attendance summary
    const att   = generateAttendance(s.id, s.attendance_rate)
    const rate  = att.length ? Math.round(((att.filter(a => a.status !== 'absent').length) / att.length) * 100) : 0
    const curY  = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 120

    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80)
    doc.text('ATTENDANCE SUMMARY', 15, curY + 12)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20)
    doc.text(`Sessions: ${att.length}   Present: ${att.filter(a => a.status === 'present').length}   Late: ${att.filter(a => a.status === 'late').length}   Absent: ${att.filter(a => a.status === 'absent').length}   Rate: ${rate}%`, 15, curY + 20)
  })

  doc.save('Mila_Player_Progress_Report.pdf')
}

// ── Report 4: Team Summary PDF ────────────────────────────────────────────────

async function generateTeamSummaryPDF() {
  const jsPDF     = await getPDF()
  const autoTable = await getAutoTable()
  const students  = loadAllStudents()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const date = new Date().toLocaleDateString('en-GB')

  TEAMS.forEach((team, idx) => {
    if (idx > 0) doc.addPage()
    const teamStudents = students.filter(s => s.team_id === team.id)

    pdfHeader(doc, `Team Summary — ${team.name}`, `${team.academy} Academy  ·  ${date}`)

    // Stats
    const avgAtt  = teamStudents.length > 0 ? Math.round(teamStudents.reduce((s, x) => s + x.attendance_rate, 0) / teamStudents.length) : 0
    const avgRate = teamStudents.length > 0 ? (teamStudents.reduce((s, x) => s + x.overall_rating, 0) / teamStudents.length).toFixed(1) : '—'
    const paid    = teamStudents.filter(s => s.payment_status === 'paid').length

    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60)
    doc.text(`Students: ${teamStudents.length}   Avg Attendance: ${avgAtt}%   Avg Rating: ${avgRate}/5   Payments Cleared: ${paid}/${teamStudents.length}`, 15, 64)

    const head = [['#', 'Name', 'Position', 'Attendance %', 'Rating', 'Payment']]
    const body = teamStudents
      .sort((a, b) => b.overall_rating - a.overall_rating)
      .map((s, i) => [i + 1, s.name, s.position, `${s.attendance_rate}%`, `${s.overall_rating}/5`, s.payment_status])

    autoTable(doc, {
      head, body,
      startY: 70,
      styles: { fontSize: 10, cellPadding: 3.5 },
      headStyles: { fillColor: [10, 10, 10], textColor: [245, 197, 24], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    })
  })

  doc.save('Mila_Team_Summary_Report.pdf')
}

// ── Report Card ───────────────────────────────────────────────────────────────

interface ReportDef {
  title: string
  description: string
  type: 'PDF' | 'Excel'
  icon: string
  color: string
  generate: () => Promise<void>
}

const REPORTS: ReportDef[] = [
  {
    title: 'Monthly Attendance Report',
    description: 'PDF table of all students with their attendance per session — present, late, absent counts and overall rate.',
    type: 'PDF', icon: '📋', color: '#3b82f6',
    generate: generateAttendancePDF,
  },
  {
    title: 'Payment Report',
    description: 'Excel sheet of all student payments for the current month — status, amounts, methods and outstanding balances.',
    type: 'Excel', icon: '💰', color: '#16a34a',
    generate: generatePaymentExcel,
  },
  {
    title: 'Player Progress Report',
    description: 'PDF per student showing full rating history across Technique, Fitness, Attitude and Teamwork, plus attendance summary.',
    type: 'PDF', icon: '📈', color: '#f5c518',
    generate: generateProgressPDF,
  },
  {
    title: 'Team Summary Report',
    description: 'PDF for each team with overall stats, ranked player list, attendance averages and payment status.',
    type: 'PDF', icon: '🏟️', color: '#f97316',
    generate: generateTeamSummaryPDF,
  },
]

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user: authUser, loading: authLoading } = useRequireAccess('reports')
  useRoster() // loads the real teams and students the reports are built from
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [done,    setDone]    = useState<Record<number, boolean>>({})

  async function run(idx: number, gen: () => Promise<void>) {
    setLoading(p => ({ ...p, [idx]: true }))
    setDone(p => ({ ...p, [idx]: false }))
    try {
      await gen()
      setDone(p => ({ ...p, [idx]: true }))
      toast(`${REPORTS[idx].title} generated`)
      setTimeout(() => setDone(p => ({ ...p, [idx]: false })), 3000)
    } catch (e) {
      console.error(e)
      toast('Failed to generate report', 'error')
    } finally {
      setLoading(p => ({ ...p, [idx]: false }))
    }
  }

  if (authLoading || !authUser) return null
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Reports</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Generate and export academy reports in PDF and Excel formats.</p>
      </div>

      <div className="reports-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <style>{`
          @media (max-width: 640px) { .reports-grid { grid-template-columns: minmax(0, 1fr) !important; } }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>

        {REPORTS.map((r, idx) => {
          const isLoading = loading[idx]
          const isDone    = done[idx]
          return (
            <div key={idx} style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Icon + type badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: `${r.color}15`, border: `1px solid ${r.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {r.icon}
                </div>
                <span style={{ backgroundColor: r.type === 'PDF' ? 'rgba(59,130,246,0.12)' : 'rgba(22,163,74,0.12)', color: r.type === 'PDF' ? '#3b82f6' : '#16a34a', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, letterSpacing: '0.5px' }}>
                  {r.type}
                </span>
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>{r.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>{r.description}</p>
              </div>

              {/* Generate button */}
              <button
                onClick={() => run(idx, r.generate)}
                disabled={isLoading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: isLoading ? 'wait' : 'pointer', border: 'none',
                  backgroundColor: isDone ? 'rgba(22,163,74,0.15)' : `${r.color}22`,
                  color: isDone ? '#16a34a' : r.color,
                  outline: `1px solid ${isDone ? 'rgba(22,163,74,0.3)' : `${r.color}44`}`,
                  transition: 'all 0.2s ease',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{ width: 14, height: 14, border: `2px solid ${r.color}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    Generating…
                  </>
                ) : isDone ? (
                  <><IconCheck size={14} /> Downloaded</>
                ) : (
                  <><IconChartBar size={14} /> Generate {r.type}</>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Info box */}
      <div style={{ marginTop: 28, padding: '16px 20px', backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0, lineHeight: 1.7 }}>
          Reports use live data from all students, attendance sessions, payments, and ratings. PDF reports open in your browser&apos;s download manager. Excel files open directly in Microsoft Excel or Google Sheets.
        </p>
      </div>
    </div>
  )
}
