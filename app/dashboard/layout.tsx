'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  IconHome, IconUsers, IconCalendarCheck, IconTrophy, IconClipboardList,
  IconCash, IconStar, IconChartBar, IconLogout,
  IconSearch, IconX, IconBuildingArch, IconMenu2, IconSun, IconMoon,
  IconListDetails, IconQuote, IconPhoto, IconWorld, IconInbox, IconUserShield, IconUserCircle,
  IconUsersGroup,
} from '@tabler/icons-react'
import { ToastContainer } from './components/ToastContainer'
import { useTheme, toggleTheme } from '@/lib/theme'
import type { StudentRow } from './students/data'
import { useAdminData } from './components/admin-ui'
import { useAllCoaches, type CoachRow } from './coaches/data'
import {
  logout, refreshSession, setSelectedAcademy,
  type SessionUser, type AcademyFilter,
} from '@/lib/auth'
import { useSession } from '@/lib/use-session'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  label: string; sub: string; href: string; category: 'Student' | 'Coach' | 'Match'
}

// ── Role styling ──────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<SessionUser['role'], string> = {
  admin:   'var(--accent-gold)',
  coach:   'var(--accent-green)',
  parent:  '#3b82f6',
  student: '#a855f7',
}

// ── Nav config ────────────────────────────────────────────────────────────────

type NavItem = { label: string; href: string; Icon: typeof IconHome; section?: string }

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard',    href: '/dashboard',                  Icon: IconHome          },
  { label: 'Students',     href: '/dashboard/students',         Icon: IconUsers         },
  { label: 'Attendance',   href: '/dashboard/attendance',       Icon: IconCalendarCheck },
  { label: 'Matches',      href: '/dashboard/matches',          Icon: IconTrophy        },
  { label: 'Coaches',      href: '/dashboard/coaches',          Icon: IconClipboardList },
  { label: 'Teams',        href: '/dashboard/teams',            Icon: IconUsersGroup    },
  { label: 'Payments',     href: '/dashboard/payments',         Icon: IconCash          },
  { label: 'Ratings',      href: '/dashboard/ratings',          Icon: IconStar          },
  { label: 'Reports',      href: '/dashboard/reports',          Icon: IconChartBar      },
]

// Admin-only: the public website editor and account management.
const ADMIN_NAV: NavItem[] = [
  { label: 'Site Content', href: '/dashboard/website',               Icon: IconWorld,       section: 'Website' },
  { label: 'Programs',     href: '/dashboard/content/programs',      Icon: IconListDetails, section: 'Website' },
  { label: 'Testimonials', href: '/dashboard/content/testimonials',  Icon: IconQuote,       section: 'Website' },
  { label: 'Gallery',      href: '/dashboard/content/gallery',       Icon: IconPhoto,       section: 'Website' },
  { label: 'Inquiries',    href: '/dashboard/content/inquiries',     Icon: IconInbox,       section: 'Website' },
  { label: 'Users',        href: '/dashboard/users',                 Icon: IconUserShield,  section: 'Admin'   },
]

const ACCOUNT_NAV: NavItem = { label: 'My Account', href: '/dashboard/account', Icon: IconUserCircle, section: 'Account' }

function navItemsFor(user: SessionUser): NavItem[] {
  if (user.role === 'admin') return [...MAIN_NAV, ...ADMIN_NAV, ACCOUNT_NAV]
  if (user.role === 'coach') return [...MAIN_NAV.filter(n => n.label !== 'Payments'), ACCOUNT_NAV]
  return [
    { label: 'My Profile', href: `/dashboard/students/${user.studentId ?? ''}`, Icon: IconBuildingArch },
    { label: 'Matches',    href: '/dashboard/matches', Icon: IconTrophy },
    ACCOUNT_NAV,
  ]
}

// ── Academy Switcher ──────────────────────────────────────────────────────────

function AcademySwitcher({ user }: { user: SessionUser }) {
  const options: AcademyFilter[] = user.academies.length === 2
    ? ['Both', 'MFA', 'MBA']
    : [user.academies[0]]

  if (options.length < 2) return null

  const acColors: Record<string, string> = {
    MFA: 'var(--accent-green)',
    MBA: 'var(--accent-orange)',
    Both: 'var(--accent-gold)',
  }
  const acHex: Record<string, string> = { MFA: '#16a34a', MBA: '#f97316', Both: '#f5c518' }

  return (
    <div style={{ padding: '4px 12px 8px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px 4px' }}>
        Academy
      </p>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(opt => {
          const active = user.selectedAcademy === opt
          const col = acColors[opt]
          const hex = acHex[opt]
          return (
            <button
              key={opt}
              onClick={() => setSelectedAcademy(opt)}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 700,
                border: `1px solid ${active ? hex : 'var(--border)'}`,
                backgroundColor: active ? `${hex}22` : 'transparent',
                color: active ? col : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Global Search ─────────────────────────────────────────────────────────────

function GlobalSearch({
  students, coaches, onNavigate,
}: { students: StudentRow[]; coaches: CoachRow[]; onNavigate?: () => void }) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const router = useRouter()
  const ref    = useRef<HTMLDivElement>(null)

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return []
    const lq  = query.toLowerCase()
    const out: SearchResult[] = []

    students.forEach(s => {
      if (s.name.toLowerCase().includes(lq) || String(s.jersey_number ?? '').includes(lq) || s.position.toLowerCase().includes(lq)) {
        const sub = [s.jersey_number ? `#${s.jersey_number}` : null, s.position || null, s.academy].filter(Boolean).join(' · ')
        out.push({ label: s.name, sub, href: `/dashboard/students/${s.id}`, category: 'Student' })
      }
    })

    coaches.forEach(c => {
      if (c.name.toLowerCase().includes(lq) || c.specialty.toLowerCase().includes(lq)) {
        out.push({ label: c.name, sub: c.specialty, href: '/dashboard/coaches', category: 'Coach' })
      }
    })

    try {
      const matches: Array<{ id: string; opponent: string; team_name: string; date: string; status: string }> =
        JSON.parse(localStorage.getItem('mila_matches') ?? '[]')
      matches.forEach(m => {
        if (m.opponent.toLowerCase().includes(lq) || m.team_name.toLowerCase().includes(lq)) {
          out.push({ label: `vs ${m.opponent}`, sub: `${m.team_name} · ${m.date} · ${m.status}`, href: '/dashboard/matches', category: 'Match' })
        }
      })
    } catch {}

    return out.slice(0, 8)
  }, [query, students, coaches])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const CAT_COLORS: Record<string, string> = {
    Student: 'var(--accent-green)',
    Coach:   'var(--accent-gold)',
    Match:   'var(--accent-orange)',
  }

  return (
    <div ref={ref} style={{ position: 'relative', maxWidth: 380, width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        backgroundColor: 'var(--bg-card)',
        border: `0.5px solid ${open ? '#f5c518' : 'var(--border)'}`,
        borderRadius: 10, padding: '8px 14px', transition: 'border-color 0.15s',
      }}>
        <IconSearch size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search students, coaches, matches…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-secondary)', fontSize: 13 }}
        />
        {query && (
          <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
            <IconX size={14} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
          backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)',
          borderRadius: 12, overflow: 'hidden', zIndex: 500,
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
        }}>
          {results.map((r, i) => (
            <div
              key={i}
              onClick={() => { router.push(r.href); setOpen(false); setQuery(''); onNavigate?.() }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', borderTop: i > 0 ? `1px solid var(--border)` : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ fontSize: 10, fontWeight: 800, color: CAT_COLORS[r.category] ?? 'var(--text-secondary)', minWidth: 48, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.category}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  user, pathname, onLogout, open, onClose, students, coaches,
}: {
  user: SessionUser; pathname: string; onLogout: () => void; open: boolean; onClose: () => void
  students: StudentRow[]; coaches: CoachRow[]
}) {
  const initials = user.name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2)
  const navItems = navItemsFor(user)
  const accentHex: Record<string, string> = { MFA: '#16a34a', MBA: '#f97316', Both: '#f5c518' }

  return (
    <>
      {/* Mobile overlay */}
      <div className={`dash-sidebar-overlay${open ? ' open' : ''}`} onClick={onClose} />

      <aside
        className={`dash-sidebar${open ? ' open' : ''}`}
        style={{
          borderLeft: `3px solid ${accentHex[user.selectedAcademy] ?? 'transparent'}`,
        }}
      >
        {/* Top: logos + brand */}
        <div style={{ padding: '24px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Image src="/logos/mfa_navbar.png" alt="MFA" width={56} height={36} style={{ height: 36, width: 'auto' }} />
            <div style={{ width: 1, height: 28, backgroundColor: 'var(--accent-gold)', opacity: 0.4 }} />
            <Image src="/logos/mba_navbar.png" alt="MBA" width={56} height={36} style={{ height: 36, width: 'auto' }} />
          </div>
          <p style={{ textAlign: 'center', color: 'var(--accent-gold)', fontSize: 11, fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', margin: '12px 0 16px' }}>
            MILA ACADEMY
          </p>
          <div style={{ height: 1, backgroundColor: 'rgba(245,197,24,0.12)', marginBottom: 12 }} />
        </div>

        {/* Mobile only: the header's search is hidden under 768px, so the
            drawer carries it — otherwise a phone has no search at all. */}
        <div className="dash-sidebar-search" style={{ padding: '0 12px 10px' }}>
          <GlobalSearch students={students} coaches={coaches} onNavigate={onClose} />
        </div>

        <AcademySwitcher user={user} />

        <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ label, href, Icon, section }, i) => (
            <div key={href} style={{ display: 'contents' }}>
              {section && section !== navItems[i - 1]?.section && (
                <p style={{
                  color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', margin: '14px 0 4px 16px',
                }}>
                  {section}
                </p>
              )}
              <Link
                href={href}
                className={`nav-item${pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/')) ? ' active' : ''}`}
                onClick={onClose}
              >
                <Icon size={20} stroke={1.8} />
                {label}
              </Link>
            </div>
          ))}
        </nav>

        {/* Bottom: user info + logout + back to site */}
        <div style={{ padding: '12px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              backgroundColor: 'rgba(245,197,24,0.15)', border: '1.5px solid rgba(245,197,24,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: 'var(--accent-gold)', fontWeight: 700, fontSize: 13,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </p>
              <span style={{
                display: 'inline-block', marginTop: 3, padding: '1px 8px',
                borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
                textTransform: 'uppercase',
                backgroundColor: `${({ admin: '#f5c518', coach: '#16a34a', parent: '#3b82f6', student: '#a855f7' }[user.role])}22`,
                color: ROLE_COLORS[user.role],
                border: `1px solid ${({ admin: '#f5c518', coach: '#16a34a', parent: '#3b82f6', student: '#a855f7' }[user.role])}44`,
              }}>
                {user.role}
              </span>
            </div>
          </div>

          <button className="logout-btn" onClick={onLogout}>
            <IconLogout size={16} stroke={1.8} />
            Sign out
          </button>

          <Link href="/" className="back-site-link">
            <span style={{ fontSize: 14 }}>←</span>
            Back to Website
          </Link>
        </div>
      </aside>
    </>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const theme = useTheme()
  const router   = useRouter()
  const pathname = usePathname()

  // Session comes from the shared external store rather than being copied into
  // local state inside an effect, which rendered once as logged-out first.
  const { user: session, ready } = useSession()
  const isLoginPage = ['/dashboard/login', '/dashboard/forgot-password', '/dashboard/reset-password'].includes(pathname)
  const user = session?.loggedIn ? session : null
  const checking = !ready

  // Touch tracking for swipe gestures
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  // The cached session is only for rendering; confirm it with the server once
  // per dashboard visit so role/name changes an admin made show up, and a
  // disabled or reset account is signed out instead of browsing a stale UI.
  useEffect(() => {
    if (isLoginPage) return
    refreshSession()
  }, [isLoginPage])

  useEffect(() => {
    if (!ready || isLoginPage) return
    if (!user) router.replace('/dashboard/login')
    else if (user.mustChangePassword && pathname !== '/dashboard/account') router.replace('/dashboard/account?first=1')
  }, [ready, isLoginPage, user, router, pathname])

  const searchCoaches = useAllCoaches()
  const { data: searchStudents } = useAdminData<StudentRow[]>('/api/admin/students', true, [])

  // Close the sidebar when the route changes. Adjusting state during render is
  // React's documented alternative to a setState-in-effect here: it re-renders
  // before committing, so the sidebar never paints open on the new page.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setSidebarOpen(false)
  }

  // Close sidebar on desktop resize
  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 768) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Swipe gesture on main content
  useEffect(() => {
    const main = document.getElementById('dash-main')
    if (!main) return

    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }
    function onTouchEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
      if (dy > 60) return // mostly vertical swipe
      if (dx > 60 && touchStartX.current < 40) setSidebarOpen(true)
      if (dx < -60) setSidebarOpen(false)
    }

    main.addEventListener('touchstart', onTouchStart, { passive: true })
    main.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      main.removeEventListener('touchstart', onTouchStart)
      main.removeEventListener('touchend',   onTouchEnd)
    }
  }, [checking])  // re-runs once the guard resolves and #dash-main exists

  // The drawer's backdrop covered the page but did not stop it scrolling, so a
  // drag anywhere on the overlay moved the content underneath.
  useEffect(() => {
    if (!sidebarOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [sidebarOpen])

  async function handleLogout() {
    await logout()
    router.replace('/dashboard/login')
  }


  if (isLoginPage) {
    if (checking) return null
    return <>{children}</>
  }

  if (checking || !user) return null

  return (
    <>
      <div style={{ minHeight: '100dvh', backgroundColor: 'var(--bg)' }}>
        <Sidebar
          user={user}
          pathname={pathname}
          onLogout={handleLogout}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          students={searchStudents}
          coaches={searchCoaches}
        />

        <div id="dash-main" className="dash-main-content-wrapper" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* ── Header ── */}
          <header
            className="dash-header"
            style={{
              height: 60, flexShrink: 0,
              backgroundColor: 'var(--bg)',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center',
              padding: '0 20px', gap: 12,
            }}
          >
            {/* Hamburger — mobile only */}
            <button
              className="dash-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-secondary)', cursor: 'pointer',
                padding: 4, borderRadius: 6, display: 'none',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, minWidth: 44,
              }}
            >
              <IconMenu2 size={22} />
            </button>

            {/* Brand title — mobile center */}
            <div
              className="dash-header-title"
              style={{
                flex: 1, textAlign: 'center',
                color: 'var(--accent-gold)', fontSize: 13, fontWeight: 700,
                letterSpacing: '2px', textTransform: 'uppercase', display: 'none',
              }}
            >
              MILA ACADEMY
            </div>

            {/* Search — desktop */}
            <div className="dash-search" style={{ flex: 1, maxWidth: 380 }}>
              <GlobalSearch students={searchStudents} coaches={searchCoaches} />
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Date — desktop */}
              <span className="dash-header-date" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>

              {/* Link back to the public homepage */}
              <Link
                href="/"
                style={{
                  color: 'var(--accent-gold)', fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px',
                  whiteSpace: 'nowrap', backgroundColor: 'var(--bg-card)',
                }}
              >
                View website ↗
              </Link>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="tap-exempt"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
                }}
              >
                {theme === 'dark' ? <IconSun size={17} stroke={1.8} /> : <IconMoon size={17} stroke={1.8} />}
              </button>
            </div>
          </header>

          <main
            className="dash-main-content"
            style={{ padding: '92px 32px 32px' }}
          >
            {children}
          </main>
        </div>
      </div>

      <ToastContainer />
    </>
  )
}
