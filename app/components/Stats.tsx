'use client'
import { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { SiteContent } from '@/lib/content-schema'

gsap.registerPlugin(ScrollTrigger)

// Splits a stored value like "500+" or "98%" into a numeric part (for the
// count-up animation) and whatever trailing suffix it had.
function parseStat(raw: string): { value: number; suffix: string } {
  const match = raw.match(/^(\d+)(.*)$/)
  if (!match) return { value: 0, suffix: raw }
  return { value: Number(match[1]), suffix: match[2] }
}

export default function Stats({ content }: { content: SiteContent }) {
  // Drop any figure that is missing or zero rather than advertising
  // "0 Players Trained". site_settings falling back (unset env, unreachable DB,
  // a cleared field) used to render the whole row as zeros on the live site.
  const STATS = useMemo(() => [
    { ...parseStat(content.players_trained),  label: content.stat1_label },
    { ...parseStat(content.years_excellence), label: content.stat2_label },
    { ...parseStat(content.academies_count),  label: content.stat3_label },
    { ...parseStat(content.success_rate),     label: content.stat4_label },
  ].filter(s => s.value > 0), [content])

  const sectionRef  = useRef<HTMLElement>(null)
  const numRefs     = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    // With reduced motion the count-up is skipped — but the markup renders "0"
    // as its starting value, so without this the section would permanently read
    // "0 Players Trained". Write the real figures straight in instead.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      numRefs.current.forEach((el, i) => {
        if (el && STATS[i]) el.textContent = STATS[i].value + STATS[i].suffix
      })
      return
    }

    // Drop refs left behind by a longer previous list.
    numRefs.current.length = STATS.length

    const ctx = gsap.context(() => {
      // Number count-up for each stat
      numRefs.current.forEach((el, i) => {
        if (!el) return
        const { value, suffix } = STATS[i]
        const obj = { val: 0 }
        gsap.to(obj, {
          val: value,
          duration: 2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
          onUpdate() {
            el.textContent = Math.round(obj.val) + suffix
          },
        })
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [STATS])

  return (
    <section
      id="about"
      ref={sectionRef}
      style={{
        backgroundColor: 'var(--color-bg)',
        padding: 'clamp(64px, 12vw, 100px) 0',
        width: '100%',
      }}
    >
      {/* Gold label */}
      <p style={{
        textAlign: 'center',
        color: 'var(--color-gold)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '6px',
        textTransform: 'uppercase',
        margin: '0 0 24px',
        padding: '0 24px',
      }}>
        {content.about_eyebrow}
      </p>

      {/* Headline */}
      <h2 className="display"
        style={{
          textAlign: 'center',
          color: 'var(--color-text)',
          fontSize: 'clamp(36px, 6vw, 56px)',
          fontWeight: 800,
          margin: '0 auto 60px',
          lineHeight: 1.1,
        }}
      >
        {content.about_title}
      </h2>

      {/* Stats grid — omitted entirely when no figures are available */}
      {STATS.length > 0 && (
      <div style={{
        maxWidth: 1000,
        margin: '0 auto',
        padding: '0 24px',
        display: 'grid',
        // Tracks the number of figures actually shown — a fixed repeat(4)
        // squeezed two surviving stats into half the row.
        gridTemplateColumns: `repeat(${STATS.length}, minmax(0, 1fr))`,
        gap: 0,
      }}
        className="stats-grid"
      >
        {STATS.map(({ suffix, label }, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 8px',
            minWidth: 0,
            borderRight: i < STATS.length - 1 ? '1px solid rgba(var(--color-gold-rgb),0.25)' : 'none',
          }}>
            <span className="display"
              ref={el => { numRefs.current[i] = el }}
              style={{
                fontSize: 'clamp(40px, 11vw, 80px)',
                fontWeight: 900,
                color: 'var(--color-gold)',
                lineHeight: 1,
                display: 'block',
              }}
            >
              {'0' + suffix}
            </span>
            <span style={{
              display: 'block',
              fontSize: 'clamp(11px, 3vw, 14px)',
              color: 'var(--color-text-dim)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              marginTop: 8,
              textAlign: 'center',
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
      )}

      {/* Divider */}
      <div style={{
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(var(--color-gold-rgb),0.2)',
        margin: '72px 0 56px',
      }} />

      {/* Quote */}
      {content.about_quote && (
      <p style={{
        textAlign: 'center',
        color: 'var(--color-text)',
        fontSize: 18,
        fontStyle: 'italic',
        opacity: 0.7,
        maxWidth: 600,
        margin: '0 auto',
        padding: '0 24px',
        lineHeight: 1.7,
      }}>
        &ldquo;{content.about_quote}&rdquo;
      </p>
      )}

      {/* Mobile responsive: 2×2 grid */}
      <style>{`
        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 36px 0 !important;
            padding: 0 16px !important;
          }
          /* Vertical rules only between the two columns, horizontal ones only
             between rows — driven by position in the grid rather than a
             hard-coded "first two", since figures that are unset get filtered
             out and the count varies. */
          .stats-grid > div {
            border-right: none !important;
          }
          .stats-grid > div:nth-child(odd):not(:last-child) {
            border-right: 1px solid rgba(var(--color-gold-rgb),0.25) !important;
          }
          .stats-grid > div:nth-last-child(n+3) {
            border-bottom: 1px solid rgba(var(--color-gold-rgb),0.2);
            padding-bottom: 36px;
          }
        }
      `}</style>
    </section>
  )
}
