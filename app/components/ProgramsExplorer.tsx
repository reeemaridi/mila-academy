'use client'
import { useState, useMemo } from 'react'
import { IconBallFootball, IconBallBasketball } from '@tabler/icons-react'
import type { SiteContent } from '@/lib/content-schema'
import {
  LEVEL_ORDER,
  ACADEMY_STYLE,
  ageLabel,
  priceLabel,
  sessionsLabel,
  type Academy,
  type Level,
  type Gender,
  type Program,
} from '@/lib/programs'

type SortKey = 'age' | 'level' | 'price' | 'gender'
type SortDir = 'asc' | 'desc'

const SORT_KEYS: { key: SortKey; label: string }[] = [
  { key: 'age',    label: 'Age'    },
  { key: 'level',  label: 'Level'  },
  { key: 'price',  label: 'Price'  },
  { key: 'gender', label: 'Gender' },
]

const GENDER_OPTS: (Gender | 'All')[] = ['All', 'Boys', 'Girls', 'Mixed']
const LEVEL_OPTS: (Level | 'All')[]   = ['All', 'Beginner', 'Intermediate', 'Elite', 'Pro']

// ── Pill button (mirrors Gallery.tsx filter tabs, tinted with academy accent) ────
function Pill({
  active, accent, accentRgb, onClick, children,
}: {
  active: boolean; accent: string; accentRgb: string
  onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px', borderRadius: 50, fontSize: 13,
        fontWeight: active ? 700 : 500, cursor: 'pointer',
        border: `1px solid ${active ? accent : 'var(--color-border-soft)'}`,
        backgroundColor: active ? `rgba(${accentRgb}, 0.14)` : 'transparent',
        color: active ? accent : 'var(--color-text-dim)',
        transition: 'all 0.18s ease', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ── Single program card (enriched Programs.tsx card + photo + badges) ────────────
function ProgramCard({
  p, accent, accentRgb, icon, enrollLabel,
}: {
  p: Program; accent: string; accentRgb: string; icon: Academy; enrollLabel: string
}) {
  const [hover, setHover] = useState(false)

  const badge = (solid: boolean): React.CSSProperties => ({
    padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
    letterSpacing: '0.3px', color: '#fff',
    backgroundColor: solid ? accent : 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(2px)',
  })

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: 'var(--color-surface)',
        border: `0.5px solid ${hover ? accent : 'var(--color-border)'}`,
        borderRadius: 4, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'none',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      {/* Header band + badges.
          REPLACE WITH REAL PHOTOGRAPHY: each card used to load a random photo
          from picsum.photos — 20 unrelated stock images across the two academy
          pages, plus 20 third-party requests. Swap in real programme photos when
          the academy supplies them. */}
      <div style={{
        position: 'relative', height: 160, flexShrink: 0, overflow: 'hidden',
        backgroundColor: 'var(--color-bg)',
        backgroundImage: 'none',
        transition: 'background-image 0.45s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {p.image_url && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, any host/size
          <img src={p.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {!p.image_url && <div aria-hidden style={{
          color: accent, opacity: hover ? 0.4 : 0.25,
          transform: hover ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 0.45s ease, opacity 0.45s ease',
        }}>
          {icon === 'football'
            ? <IconBallFootball size={72} stroke={1.25} />
            : <IconBallBasketball size={72} stroke={1.25} />}
        </div>}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
          <span style={badge(true)}>{p.level}</span>
          <span style={badge(false)}>{p.gender}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
            backgroundColor: `rgba(${accentRgb}, 0.12)`,
            border: `1px solid rgba(${accentRgb}, 0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
          }}>
            {icon === 'football'
              ? <IconBallFootball size={24} stroke={1.75} />
              : <IconBallBasketball size={24} stroke={1.75} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: 'var(--color-text)', fontSize: 19, fontWeight: 700, margin: '0 0 2px' }}>
              {p.name}
            </p>
            <p style={{ color: accent, fontSize: 13, fontWeight: 500, margin: 0 }}>
              {p.subtitle}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
          {[ageLabel(p), sessionsLabel(p), priceLabel(p)].map((text) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', backgroundColor: accent,
                flexShrink: 0, display: 'inline-block',
              }} />
              <span style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>{text}</span>
            </div>
          ))}
        </div>

        <a
          href="#enroll"
          style={{
            marginTop: 22, width: '100%', padding: '13px 0', borderRadius: 10,
            border: 'none', backgroundColor: accent, color: '#fff',
            fontSize: 14, fontWeight: 700, letterSpacing: '0.3px',
            textAlign: 'center', textDecoration: 'none', display: 'block', cursor: 'pointer',
          }}
        >
          {enrollLabel}
        </a>
      </div>
    </div>
  )
}

// ── Explorer ─────────────────────────────────────────────────────────────────────
export default function ProgramsExplorer({
  academy, programs, content,
}: { academy: Academy; programs: Program[]; content: SiteContent }) {
  const meta = { ...ACADEMY_STYLE[academy], icon: academy }

  const [sortKey, setSortKey] = useState<SortKey>('age')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [gender,  setGender]  = useState<Gender | 'All'>('All')
  const [level,   setLevel]   = useState<Level | 'All'>('All')

  const list = useMemo(() => {
    let r = programs
    if (gender !== 'All') r = r.filter((p) => p.gender === gender)
    if (level  !== 'All') r = r.filter((p) => p.level === level)
    r = [...r].sort((a, b) => {
      let c = 0
      if (sortKey === 'age')    c = a.age_min - b.age_min
      if (sortKey === 'price')  c = a.price_month - b.price_month
      if (sortKey === 'level')  c = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
      if (sortKey === 'gender') c = a.gender.localeCompare(b.gender)
      return sortDir === 'asc' ? c : -c
    })
    return r
  }, [programs, gender, level, sortKey, sortDir])

  const labelStyle: React.CSSProperties = {
    color: 'var(--color-text-faint)', fontSize: 11, fontWeight: 700,
    letterSpacing: '2px', textTransform: 'uppercase', margin: 0, whiteSpace: 'nowrap',
  }

  return (
    <section id="programs" style={{ backgroundColor: 'var(--color-bg)', padding: 'clamp(56px, 10vw, 80px) 18px' }}>
      <style>{`
        .pe-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
        @media (max-width: 1024px) { .pe-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px)  { .pe-grid { grid-template-columns: minmax(0, 1fr); } }
        .pe-controls-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <h2 className="display" style={{ color: 'var(--color-text)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1 }}>
          {content.academy_programs_title}
        </h2>
        <p style={{ color: meta.accent, fontSize: 14, margin: '0 0 32px', letterSpacing: '0.5px' }}>
          {list.length} program{list.length === 1 ? '' : 's'} · {content.academy_programs_hint}
        </p>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 36 }}>
          {/* Sort */}
          <div className="pe-controls-row">
            <p style={labelStyle}>Sort by</p>
            {SORT_KEYS.map(({ key, label }) => (
              <Pill key={key} active={sortKey === key} accent={meta.accent} accentRgb={meta.accentRgb} onClick={() => setSortKey(key)}>
                {label}
              </Pill>
            ))}
            <button
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              aria-label={`Sort direction: ${sortDir === 'asc' ? 'ascending' : 'descending'}`}
              className="tap-exempt"
              style={{
                width: 38, height: 34, borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--color-border-soft)', backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)', fontSize: 15, fontWeight: 700, lineHeight: 1,
              }}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* Gender filter */}
          <div className="pe-controls-row">
            <p style={labelStyle}>Gender</p>
            {GENDER_OPTS.map((g) => (
              <Pill key={g} active={gender === g} accent={meta.accent} accentRgb={meta.accentRgb} onClick={() => setGender(g)}>
                {g}
              </Pill>
            ))}
          </div>

          {/* Level filter */}
          <div className="pe-controls-row">
            <p style={labelStyle}>Level</p>
            {LEVEL_OPTS.map((l) => (
              <Pill key={l} active={level === l} accent={meta.accent} accentRgb={meta.accentRgb} onClick={() => setLevel(l)}>
                {l}
              </Pill>
            ))}
          </div>
        </div>

        {/* Grid / empty state */}
        {list.length === 0 ? (
          <div style={{
            padding: '60px 24px', textAlign: 'center',
            border: '1px dashed var(--color-border-soft)', borderRadius: 16,
            color: 'var(--color-text-dim)', fontSize: 15,
          }}>
            No programs match these filters.{' '}
            <button
              onClick={() => { setGender('All'); setLevel('All') }}
              style={{ background: 'none', border: 'none', color: meta.accent, fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="pe-grid">
            {list.map((p) => (
              <ProgramCard key={p.id} p={p} accent={meta.accent} accentRgb={meta.accentRgb} icon={meta.icon} enrollLabel={content.programs_enroll_label} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
