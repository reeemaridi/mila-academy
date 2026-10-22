import Link from 'next/link'
import Image from 'next/image'
import type { SiteContent } from '@/lib/content-schema'

// Two halves, one per academy. No ball illustrations and no glow: each half is
// a flat tint of its sport colour with the pitch / court markings drawn as thin
// line work, and a real photograph laid under it as soon as one is uploaded
// (Site Content → academy → Page banner photo).

function PitchLines() {
  // Half-way line, centre circle and one penalty area, cropped by the edge of
  // the half so it reads as a plan of a pitch rather than an icon.
  return (
    <svg className="hero-lines" viewBox="0 0 600 700" fill="none" stroke="currentColor"
      strokeWidth="2" aria-hidden preserveAspectRatio="xMaxYMax slice">
      <line x1="0" y1="350" x2="600" y2="350" />
      <circle cx="300" cy="350" r="120" />
      <circle cx="300" cy="350" r="5" fill="currentColor" />
      <rect x="130" y="0" width="340" height="150" />
      <rect x="220" y="0" width="160" height="56" />
      <path d="M 235 150 A 80 80 0 0 0 365 150" />
    </svg>
  )
}

function CourtLines() {
  // Paint, free-throw circle and three-point arc.
  return (
    <svg className="hero-lines" viewBox="0 0 600 700" fill="none" stroke="currentColor"
      strokeWidth="2" aria-hidden preserveAspectRatio="xMaxYMax slice">
      <rect x="0" y="0" width="600" height="700" />
      <rect x="210" y="0" width="180" height="270" />
      <circle cx="300" cy="270" r="90" />
      <path d="M 40 0 L 40 130 A 270 270 0 0 0 560 130 L 560 0" />
      <path d="M 255 40 A 45 45 0 0 0 345 40" />
    </svg>
  )
}

export default function Hero({ content }: { content: SiteContent }) {
  const halves = [
    {
      key: 'football', href: '/football', cls: 'hero-fb', Lines: PitchLines,
      name: content.football_name, est: content.football_est,
      line: content.football_tagline, photo: content.football_hero_image, n: '01',
    },
    {
      key: 'basketball', href: '/basketball', cls: 'hero-bb', Lines: CourtLines,
      name: content.basketball_name, est: content.basketball_est,
      line: content.basketball_tagline, photo: content.basketball_hero_image, n: '02',
    },
  ] as const

  return (
    <>
      <style>{`
        .hero-split {
          height: 100vh;
          height: 100dvh;
          display: flex;
          flex-direction: row;
          padding-top: 60px;
          background: var(--color-bg);
        }
        .hero-half {
          flex: 1; min-width: 0; min-height: 0; position: relative; overflow: hidden;
          display: flex; flex-direction: column; justify-content: flex-end;
          padding: clamp(24px, 4vw, 56px);
          color: var(--color-text); text-decoration: none;
          transition: flex-grow 0.5s ease;
        }
        .hero-fb { background: color-mix(in srgb, var(--color-football) 16%, var(--color-bg)); --tone: var(--color-football); }
        .hero-bb { background: color-mix(in srgb, var(--color-basketball) 16%, var(--color-bg)); --tone: var(--color-basketball); }
        .hero-split:hover .hero-half { flex-grow: 0.85; }
        .hero-split .hero-half:hover { flex-grow: 1.3; }
        .hero-photo { object-fit: cover; opacity: 0.55; mix-blend-mode: luminosity; }
        .hero-lines {
          position: absolute; right: -4%; bottom: -3%; width: min(78%, 520px); height: auto;
          color: var(--tone); opacity: 0.28; transition: opacity 0.4s ease, transform 0.6s ease;
          pointer-events: none;
        }
        .hero-half:hover .hero-lines { opacity: 0.5; transform: translateY(-6px); }
        .hero-body { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px; max-width: 30rem; }
        .hero-num { font-size: 12px; letter-spacing: 0.18em; color: var(--tone); font-weight: 600; }
        .hero-name {
          font-family: var(--font-display), system-ui, sans-serif;
          font-stretch: 78%; text-transform: uppercase; font-weight: 800;
          font-size: clamp(40px, 6.4vw, 92px); line-height: 0.92; letter-spacing: -0.01em; margin: 0;
        }
        .hero-line { font-size: 15px; line-height: 1.5; color: var(--color-text-dim); margin: 0; }
        .hero-est { font-size: 12px; letter-spacing: 0.08em; color: var(--color-text-faint); margin: 0; }
        .hero-enter {
          margin-top: 8px; align-self: flex-start; font-size: 14px; font-weight: 600;
          padding-bottom: 4px; border-bottom: 1px solid var(--tone); color: var(--color-text);
          transition: gap 0.2s ease; display: inline-flex; gap: 8px;
        }
        .hero-half:hover .hero-enter { gap: 14px; }
        .hero-divider { width: 1px; background: var(--color-border-soft); flex-shrink: 0; }

        @media (max-width: 768px) {
          .hero-split { flex-direction: column; }
          .hero-split:hover .hero-half, .hero-split .hero-half:hover { flex-grow: 1; }
          .hero-half { padding: 16px 20px; justify-content: center; }
          .hero-body { gap: 8px; }
          .hero-name { font-size: clamp(28px, 8.5vw, 46px); }
          .hero-line { display: none; }
          .hero-lines { width: 62%; }
          .hero-divider { width: auto; height: 1px; }
        }
        @media (max-width: 768px) and (max-height: 720px) { .hero-est { display: none; } .hero-num { display: none; } }
        @media (prefers-reduced-motion: reduce) {
          .hero-half, .hero-lines, .hero-enter { transition: none; }
        }
      `}</style>

      <section id="hero" className="hero-split">
        {halves.map((h, i) => (
          <div key={h.key} style={{ display: 'contents' }}>
            {i === 1 && <div className="hero-divider" />}
            <Link href={h.href} className={`hero-half ${h.cls}`}>
              {h.photo && (
                <Image src={h.photo} alt="" fill sizes="50vw" className="hero-photo" preload={i === 0} />
              )}
              <h.Lines />
              <div className="hero-body">
                <span className="hero-num">{h.n}</span>
                <h2 className="hero-name">{h.name}</h2>
                {h.line && <p className="hero-line">{h.line}</p>}
                <p className="hero-est">{h.est}</p>
                <span className="hero-enter">{content.hero_enter_label}</span>
              </div>
            </Link>
          </div>
        ))}
      </section>
    </>
  )
}
