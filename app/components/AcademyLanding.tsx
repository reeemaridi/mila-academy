import Image from 'next/image'
import Link from 'next/link'
import type { SiteContent } from '@/lib/content-schema'
import { ACADEMY_STYLE, type Academy, type Program } from '@/lib/programs'
import ProgramsExplorer from './ProgramsExplorer'

export default function AcademyLanding({
  academy, content, programs,
}: { academy: Academy; content: SiteContent; programs: Program[] }) {
  const meta = {
    ...ACADEMY_STYLE[academy],
    name:      content[`${academy}_name`],
    tagline:   content[`${academy}_tagline`],
    est:       content[`${academy}_est`],
    logo:      content[`${academy}_logo`],
    heroImage: content[`${academy}_hero_image`],
    ctaTitle:  content[`${academy}_cta_title`],
    ctaText:   content[`${academy}_cta_text`],
  }
  const settings = content
  // Empty when site_settings has no number — the WhatsApp CTAs are hidden in
  // that case rather than pointing at a bare https://wa.me/ .
  const wa = settings.whatsapp_number ? `https://wa.me/${settings.whatsapp_number}` : ''

  const heroBtn: React.CSSProperties = {
    padding: '12px 26px', borderRadius: 8, fontWeight: 700, fontSize: 14,
    textDecoration: 'none', color: '#fff',
  }

  return (
    <main>
      {/* ── Hero banner ─────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', minHeight: 460, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '60px 24px 0',
      }}>
        {/* Branded backdrop in the academy's accent colour, or the banner
            photo an admin uploaded (Site Content → academy → Page banner photo). */}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            // A flat tint of the academy colour — no radial glows.
            backgroundColor: `color-mix(in srgb, ${meta.accent} 24%, #121110)`,
          }}
        />
        {meta.heroImage && (
          <Image src={meta.heroImage} alt="" fill sizes="100vw" style={{ objectFit: 'cover' }} preload />
        )}
        {/* Scrim keeps the white hero text readable in both themes */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.6) 100%)',
        }} />

        <div style={{
          position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 14, padding: '48px 0',
        }}>
          <Image src={meta.logo} alt={meta.name} width={96} height={64} style={{ height: 64, width: 'auto' }} preload />
          <h1 className="display" style={{ color: '#fff', fontSize: 'clamp(34px, 6.5vw, 60px)', fontWeight: 800, textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>
            {meta.name}
          </h1>
          <p style={{ color: meta.accent, fontSize: 16, fontWeight: 600, letterSpacing: '0.5px', margin: 0 }}>
            {meta.tagline}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>{meta.est}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
            <a href="#programs" style={{ ...heroBtn, backgroundColor: meta.accent }}>{content.academy_view_programs}</a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" style={{ ...heroBtn, backgroundColor: '#25D366' }}>
                {content.whatsapp_label}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Sortable / filterable programs ──────────────────────────────────── */}
      <ProgramsExplorer academy={academy} programs={programs} content={content} />

      {/* ── Enroll CTA ──────────────────────────────────────────────────────── */}
      <section id="enroll" style={{
        backgroundColor: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
        padding: '72px 24px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <h2 className="display" style={{ color: 'var(--color-text)', fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 800, margin: '0 0 14px', lineHeight: 1.15 }}>
            {meta.ctaTitle}
          </h2>
          <p style={{ color: 'var(--color-text-dim)', fontSize: 15, lineHeight: 1.7, margin: '0 0 28px' }}>
            {meta.ctaText}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" style={{
                backgroundColor: '#25D366', color: '#fff', padding: '13px 28px', borderRadius: 10,
                fontWeight: 700, fontSize: 15, textDecoration: 'none',
              }}>
                {content.whatsapp_label}
              </a>
            )}
            <Link href="/#contact" style={{
              backgroundColor: 'transparent', color: meta.accent, border: `1px solid ${meta.accent}`,
              padding: '13px 28px', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none',
            }}>
              {content.academy_enroll_label}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
