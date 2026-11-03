'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// A step-by-step setup guide for a new administrator. It dims the screen,
// highlights the sidebar item for each step with an arrow, and says what to do
// there. It opens by itself the first time an admin signs in (once their
// temporary password is replaced) and can be reopened from "Setup guide" in the
// top bar. Finishing or skipping is remembered in this browser, per account.

interface Step {
  title: string
  text: string
  /** the sidebar link this step points at; none = a centred message */
  href?: string
  /** what to do once there, shown after "Take me there" */
  todo?: string
}

const STEPS: Step[] = [
  {
    title: 'Welcome! Let’s set up your academy',
    text: 'This quick guide walks you through the setup in the order that works best. It takes about ten minutes, and you can stop at any time and come back from “Setup guide” at the top.',
  },
  {
    href: '/dashboard/teams',
    title: '1. Create your teams',
    text: 'Start here: students and coaches are assigned to teams, and every other screen (attendance, ratings, payments) lists them.',
    todo: 'Click “New team”, then give it a name, the academy (football or basketball) and an age group.',
  },
  {
    href: '/dashboard/coaches',
    title: '2. Add your coaches',
    text: 'Each coach is created together with their own sign-in. Tick the teams they look after: they will only see those teams’ students.',
    todo: 'Click “Add Coach”, fill in the details and their email, then press “Add Coach and create sign-in”. Copy the temporary password shown and send it to them: it appears only once.',
  },
  {
    href: '/dashboard/students',
    title: '3. Add your students',
    text: 'Add each player with their birth date, team and parent details. You can also give the parent a sign-in at the same time.',
    todo: 'Click “Add Student”. On the last tab, “Login”, tick “Create a sign-in” to give the parent access, then copy the password shown.',
  },
  {
    href: '/dashboard/payments',
    title: '4. Track payments',
    text: 'Payments are recorded per month or per day. Open a student and use their Payments tab to add records and mark them paid or not paid.',
    todo: 'To let one coach handle payments, open Users, edit that coach and tick “Can view and update payments”.',
  },
  {
    href: '/dashboard/website',
    title: '5. Make the website yours',
    text: 'Every text and picture on the public homepage can be changed here without any code: names, logos, the numbers, contact details and social links.',
    todo: 'Pick a section on the left, change what you need, then press “Save & publish”.',
  },
  {
    href: '/dashboard/content/programs',
    title: '6. Add your programs',
    text: 'The programs shown on the football and basketball pages. Add the real ones for your age groups, with price and sessions per week.',
    todo: 'Click “Add program” and star the ones you want on the homepage.',
  },
  {
    href: '/dashboard/content/inquiries',
    title: '7. Answer new sign-ups',
    text: 'Families who fill in the enquiry form on the website show up here. You are not emailed, so check this page regularly.',
    todo: 'Press “Create student” on an enquiry to open the Add Student form already filled in.',
  },
  {
    href: '/dashboard/users',
    title: '8. Manage everyone’s access',
    text: 'All accounts are here. You can reset a password, disable someone, or download a sign-in sheet with every coach and parent’s details.',
    todo: 'Use “Sign-in sheet” to download a spreadsheet to hand out. Share it privately and delete it afterwards.',
  },
  {
    title: 'You’re all set',
    text: 'Open “View website” at the top to see how the public site looks. You can run this guide again any time from “Setup guide”.',
  },
]

const KEY = (userId: string) => `mila_tour_${userId}`

interface Box { top: number; left: number; width: number; height: number }

export default function AdminTour({ userId }: { userId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem(KEY(userId)) } catch { return false }
  })
  const [step, setStep] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [wide, setWide] = useState(true)

  const current = STEPS[step]

  const measure = useCallback(() => {
    const isWide = window.innerWidth > 768
    setWide(isWide)
    if (!current.href || !isWide) { setBox(null); return }
    const el = document.querySelector<HTMLElement>(`aside a[href="${current.href}"]`)
    if (!el) { setBox(null); return }
    el.scrollIntoView({ block: 'nearest' })
    const r = el.getBoundingClientRect()
    setBox(r.width > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
  }, [current.href])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', measure) }
  }, [open, step, measure])

  // "Setup guide" in the top bar reopens it from the start.
  useEffect(() => {
    const reopen = () => { setStep(0); setOpen(true) }
    window.addEventListener('mila-open-tour', reopen)
    return () => window.removeEventListener('mila-open-tour', reopen)
  }, [])

  function finish() {
    try { localStorage.setItem(KEY(userId), 'done') } catch {}
    setOpen(false)
  }

  function goThere() {
    if (current.href) router.push(current.href)
  }

  if (!open) return null

  const last = step === STEPS.length - 1
  const card = {
    backgroundColor: 'var(--bg-card)', border: '1px solid #f5c518', borderRadius: 14, padding: 20,
    width: 'min(340px, calc(100vw - 32px))', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', color: 'var(--text-primary)',
  } as const

  // Place the card to the right of the highlighted sidebar item, kept on screen.
  const top = box ? Math.max(16, Math.min(box.top - 12, window.innerHeight - 330)) : 0
  const cardPos = box && wide
    ? { position: 'fixed' as const, top, left: box.left + box.width + 22, zIndex: 3002 }
    : { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 3002 }

  return (
    <div role="dialog" aria-label="Setup guide" aria-modal="false">
      <style>{`
        @keyframes tour-nudge { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-7px); } }
        @media (prefers-reduced-motion: reduce) { .tour-arrow { animation: none !important; } }
      `}</style>

      {/* dim everything; the highlighted item is a hole in the dimming */}
      {box ? (
        <div style={{
          position: 'fixed', zIndex: 3000, top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8,
          borderRadius: 10, boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)', border: '2px solid #f5c518', pointerEvents: 'none',
        }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: 'rgba(0,0,0,0.62)' }} />
      )}

      {/* arrow pointing at the item */}
      {box && wide && (
        <div className="tour-arrow" aria-hidden style={{
          position: 'fixed', zIndex: 3001, top: box.top + box.height / 2 - 14, left: box.left + box.width + 6,
          fontSize: 28, lineHeight: '28px', color: '#f5c518', animation: 'tour-nudge 1s ease-in-out infinite',
        }}>◀</div>
      )}

      <div style={{ ...card, ...cardPos }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 6px' }}>
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.3 }}>{current.title}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{current.text}</p>
        {current.todo && (
          <p style={{ color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, margin: '12px 0 0', padding: '10px 12px', borderRadius: 8, backgroundColor: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.3)' }}>
            <strong>To do:</strong> {current.todo}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={btn('ghost')}>Back</button>
          )}
          {current.href && (
            <button onClick={goThere} style={btn('ghost')}>Take me there</button>
          )}
          <button onClick={() => (last ? finish() : setStep(s => s + 1))} style={{ ...btn('primary'), marginLeft: 'auto' }}>
            {last ? 'Finish' : step === 0 ? 'Start' : 'Next →'}
          </button>
        </div>
        {!last && (
          <button onClick={finish} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', marginTop: 12, padding: 0, textDecoration: 'underline' }}>
            Skip the guide
          </button>
        )}
      </div>
    </div>
  )
}

function btn(kind: 'primary' | 'ghost') {
  return {
    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    ...(kind === 'primary'
      ? { backgroundColor: '#f5c518', color: '#000', border: 'none' }
      : { backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' }),
  } as const
}
