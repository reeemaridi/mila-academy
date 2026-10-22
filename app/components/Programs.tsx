'use client'
import { useState } from 'react'
import { IconBallFootball, IconBallBasketball } from '@tabler/icons-react'
import { scrollToSection } from '@/lib/lenis-store'
import type { SiteContent } from '@/lib/content-schema'
import { ageLabel, priceLabel, sessionsLabel, type Program } from '@/lib/programs'

const SPORT_STYLE = {
  football:   { color: 'var(--color-football)',   colorRgb: 'var(--color-football-rgb)',   Icon: IconBallFootball   },
  basketball: { color: 'var(--color-basketball)', colorRgb: 'var(--color-basketball-rgb)', Icon: IconBallBasketball },
} as const

export default function Programs({ programs, content }: { programs: Program[]; content: SiteContent }) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  if (programs.length === 0) return null

  return (
    <section id="programs" style={{ backgroundColor: 'var(--color-bg)', padding: 'clamp(64px, 12vw, 100px) 18px' }}>
      <style>{`
        .programs-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        @media (max-width: 1024px) { .programs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px)  { .programs-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 0 36px' }}>
        <h2 className="display"
          style={{
            color: 'var(--color-text)',
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 800,
            margin: '0 0 10px',
            lineHeight: 1.1,
          }}
        >
          {content.programs_title}
        </h2>
        <p
          style={{
            color: 'var(--color-gold)',
            fontSize: 14,
            margin: 0,
            letterSpacing: '1px',
          }}
        >
          {content.programs_subtitle}
        </p>
      </div>

      {/* Cards grid */}
      <div className="programs-grid">
        {programs.map((prog, i) => {
          const { color, Icon } = SPORT_STYLE[prog.sport]
          return (
            <div
              key={prog.id}
              onMouseEnter={() => setHoveredCard(i)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: `0.5px solid ${hoveredCard === i ? color : 'var(--color-border)'}`,
                borderRadius: 4,
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'none',
                transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                cursor: 'default',
              }}
            >
              {/* Sport mark: plain, no tinted circle */}
              <div style={{ marginBottom: 18, flexShrink: 0, color }}>
                <Icon size={26} stroke={1.75} />
              </div>

              {/* Name */}
              <p
                style={{
                  color: 'var(--color-text)',
                  fontSize: 20,
                  fontWeight: 700,
                  margin: '0 0 5px',
                }}
              >
                {prog.name}
              </p>

              {/* Subtitle */}
              <p
                style={{
                  color: 'var(--color-gold)',
                  fontSize: 13,
                  fontWeight: 500,
                  margin: '0 0 22px',
                }}
              >
                {prog.subtitle}
              </p>

              {/* Detail rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
                {[ageLabel(prog), sessionsLabel(prog), priceLabel(prog)].map((text) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: color,
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* Enroll Now */}
              <button
                onClick={() => scrollToSection('contact')}
                style={{
                  marginTop: 22,
                  width: '100%',
                  padding: '13px 0',
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: color,
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.3px',
                }}
              >
                {content.programs_enroll_label}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
