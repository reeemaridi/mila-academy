'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { GalleryPhoto } from '@/lib/site-data'
import type { SiteContent } from '@/lib/content-schema'

type Category = 'all' | 'football' | 'basketball' | 'events'

const FILTERS: { key: Category; label: string }[] = [
  { key: 'all',        label: 'All'        },
  { key: 'football',   label: 'Football'   },
  { key: 'basketball', label: 'Basketball' },
  { key: 'events',     label: 'Events'     },
]

export default function Gallery({ photos, content }: { photos: GalleryPhoto[]; content: SiteContent }) {
  const [activeTab,    setActiveTab]    = useState<Category>('all')
  const [visible,      setVisible]      = useState(true)
  const [hoveredId,    setHoveredId]    = useState<string | null>(null)
  const [lightboxIdx,  setLightboxIdx]  = useState<number | null>(null)

  // Derived from props rather than copied into state. The photos list is
  // refetched by the server every 60s (`revalidate`), and a state copy taken at
  // mount would keep showing the old set — including photos an admin had just
  // deleted — until a full reload.
  const displayed = useMemo(
    () => (activeTab === 'all' ? photos : photos.filter(img => img.category === activeTab)),
    [photos, activeTab],
  )

  // The page kept scrolling underneath the open lightbox — very obvious on a
  // phone, where the backdrop fills the screen and a stray drag moves the page.
  useEffect(() => {
    if (lightboxIdx === null) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [lightboxIdx])

  // Keyboard navigation for lightbox
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightboxIdx === null) return
      if (e.key === 'Escape')      setLightboxIdx(null)
      if (e.key === 'ArrowRight')  setLightboxIdx(p => (p! + 1) % displayed.length)
      if (e.key === 'ArrowLeft')   setLightboxIdx(p => (p! - 1 + displayed.length) % displayed.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIdx, displayed.length])

  // Lock scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightboxIdx !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightboxIdx])

  // Clear a pending fade on unmount so it can't fire against a gone component.
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (fadeTimer.current) clearTimeout(fadeTimer.current) }, [])

  const switchTab = useCallback((tab: Category) => {
    if (tab === activeTab) return
    setLightboxIdx(null)
    setVisible(false)
    if (fadeTimer.current) clearTimeout(fadeTimer.current)
    fadeTimer.current = setTimeout(() => {
      setActiveTab(tab)
      setVisible(true)
    }, 200)
  }, [activeTab])

  const touchX = useRef(0)
  const touchY = useRef(0)

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    const dy = e.changedTouches[0].clientY - touchY.current
    if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 40) return
    setLightboxIdx(prev =>
      prev === null ? prev : (prev + (dx < 0 ? 1 : -1) + displayed.length) % displayed.length,
    )
  }

  const openLightbox = (img: GalleryPhoto) => {
    const idx = displayed.findIndex(d => d.id === img.id)
    setLightboxIdx(idx)
  }

  const activeLightbox = lightboxIdx !== null ? displayed[lightboxIdx] : null

  if (photos.length === 0) return null

  return (
    <section id="gallery" style={{ backgroundColor: 'var(--color-bg)', padding: 'clamp(64px, 12vw, 100px) 20px' }}>
      <style>{`
        .gallery-grid { columns: 3; column-gap: 12px; }
        @media (max-width: 1024px) { .gallery-grid { columns: 2; } }
        @media (max-width: 640px)  { .gallery-grid { columns: 1; } }

        /* Phone lightbox: the photo takes the full width and the two arrows
           drop to the bottom bar beside the counter instead of sitting on top
           of it. Swipe works either way. */
        @media (max-width: 640px) {
          .lb-img    { max-width: 96vw !important; max-height: 64vh !important; }
          .lb-arrow  { top: auto !important; bottom: 18px !important; font-size: 40px !important; }
          .lb-prev   { left: 10px !important; }
          .lb-next   { right: 10px !important; }
          .lb-caption{ bottom: 30px !important; padding: 0 76px !important; }
        }
      `}</style>

      {/* Title */}
      <h2 className="display" style={{
        textAlign: 'center',
        color: 'var(--color-text)',
        fontSize: 'clamp(32px, 5vw, 48px)',
        fontWeight: 800,
        margin: '0 0 48px',
        lineHeight: 1.1,
      }}>
        {content.gallery_title}
      </h2>

      {/* Filter tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            style={{
              padding: '9px 22px',
              borderRadius: 50,
              border: `1px solid ${activeTab === key ? 'var(--color-gold)' : 'var(--color-border-soft)'}`,
              backgroundColor: activeTab === key ? 'var(--color-gold)' : 'transparent',
              color: activeTab === key ? '#000' : 'var(--color-text-dim)',
              fontSize: 13,
              fontWeight: activeTab === key ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.22s ease',
              letterSpacing: '0.3px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Masonry grid */}
      <div style={{ maxWidth: 1200, margin: '0 auto', opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease' }}>
        <div className="gallery-grid">
          {/* Each tile is a real <button>, not a clickable <div> — the lightbox
              was mouse-only before, unreachable by keyboard or screen reader. */}
          {displayed.map(img => (
            <button
              key={img.id}
              type="button"
              onMouseEnter={() => setHoveredId(img.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(img.id)}
              onBlur={() => setHoveredId(null)}
              onClick={() => openLightbox(img)}
              aria-label={`Open photo: ${img.caption || 'untitled'}`}
              style={{
                breakInside: 'avoid',
                marginBottom: 12,
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
                display: 'block',
                width: '100%',
                padding: 0,
                border: 'none',
                background: 'none',
                textAlign: 'left',
              }}
            >
              {/* Image */}
              {/* eslint-disable-next-line @next/next/no-img-element -- variable aspect ratios from admin uploads, native masonry sizing */}
              <img
                src={img.image_url}
                alt={img.caption}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  transform: hoveredId === img.id ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.45s ease',
                }}
              />

              {/* Dark overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.58)',
                opacity: hoveredId === img.id ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }} />

              {/* Caption slides up */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '14px 16px',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.3px',
                transform: hoveredId === img.id ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.32s ease',
                background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
              }}>
                {img.caption}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {activeLightbox && (
        <div
          onClick={() => setLightboxIdx(null)}
          onTouchStart={e => { touchX.current = e.touches[0].clientX; touchY.current = e.touches[0].clientY }}
          onTouchEnd={onTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label={activeLightbox.caption || 'Photo viewer'}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.96)',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Close */}
          <button
            onClick={() => setLightboxIdx(null)}
            aria-label="Close photo viewer"
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'none', border: 'none',
              color: '#fff', fontSize: 30, lineHeight: 1,
              cursor: 'pointer', opacity: 0.75,
              minWidth: 44, minHeight: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>

          {/* Prev */}
          <button
            className="lb-arrow lb-prev"
            onClick={e => { e.stopPropagation(); setLightboxIdx(p => (p! - 1 + displayed.length) % displayed.length) }}
            aria-label="Previous photo"
            style={{
              position: 'absolute', left: 20,
              background: 'none', border: 'none',
              color: 'var(--color-gold)', fontSize: 52, lineHeight: 1,
              cursor: 'pointer', padding: '8px 14px', opacity: 0.9,
            }}
          >
            ‹
          </button>

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element -- lightbox needs the original remote URL, not a build-time-optimized one */}
          <img
            className="lb-img"
            src={activeLightbox.image_url}
            alt={activeLightbox.caption}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '82vw',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: 10,
              boxShadow: '0 0 60px rgba(0,0,0,0.8)',
            }}
          />

          {/* Next */}
          <button
            className="lb-arrow lb-next"
            onClick={e => { e.stopPropagation(); setLightboxIdx(p => (p! + 1) % displayed.length) }}
            aria-label="Next photo"
            style={{
              position: 'absolute', right: 20,
              background: 'none', border: 'none',
              color: 'var(--color-gold)', fontSize: 52, lineHeight: 1,
              cursor: 'pointer', padding: '8px 14px', opacity: 0.9,
            }}
          >
            ›
          </button>

          {/* Caption + counter */}
          <div className="lb-caption" style={{
            position: 'absolute', bottom: 24,
            left: 0, right: 0, textAlign: 'center', padding: '0 24px',
          }}>
            <p style={{ color: '#fff', fontSize: 15, opacity: 0.85, margin: '0 0 4px' }}>
              {activeLightbox.caption}
            </p>
            <p style={{ color: 'var(--color-text-faint)', fontSize: 12, margin: 0 }}>
              {lightboxIdx! + 1} / {displayed.length}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
