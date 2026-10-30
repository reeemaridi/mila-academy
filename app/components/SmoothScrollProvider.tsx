'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { setLenisInstance, scrollToHash } from '@/lib/lenis-store'

gsap.registerPlugin(ScrollTrigger)

export default function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Lenis takes over the mouse wheel and scrolls the window, so on the
  // dashboard a wheel over the sidebar, a table or a dialog moved the page
  // behind it instead — the sidebar couldn't be scrolled to its lower links at
  // all. The dashboard has no scroll animations, so it uses native scrolling.
  const onDashboard = pathname.startsWith('/dashboard')

  useEffect(() => {
    if (onDashboard) return

    // Respect the OS "reduce motion" setting: smooth-scroll hijacking is
    // exactly the kind of motion WCAG 2.3.3 asks us to drop. Without this the
    // page keeps easing under the user no matter what they've asked for.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      // Still replay an inbound /#section link, just without the animation.
      const id = window.location.hash.slice(1)
      if (id) {
        requestAnimationFrame(() => {
          document.getElementById(id)?.scrollIntoView()
        })
      }
      return
    }

    const lenis = new Lenis()
    setLenisInstance(lenis)

    // Without this, GSAP's ScrollTrigger (used by Stats' count-up, etc.)
    // listens for native scroll events while Lenis smooths scrolling
    // independently — the two fall out of sync, and ScrollTrigger's
    // position recalculation shows up as a visible page jump/lag right
    // when a scroll-triggered animation fires.
    lenis.on('scroll', ScrollTrigger.update)

    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      setLenisInstance(null)
    }
  }, [onDashboard])

  // Replay the URL hash after every navigation.
  //
  // Two things suppress the browser's own jump: Lenis takes ownership of the
  // scroll position, and this provider lives in the root layout so it does not
  // remount when the route changes. Without this, arriving at /#contact from the
  // football page (or on a cold load) just lands at the top of the homepage.
  useEffect(() => {
    if (!window.location.hash) return
    const t = window.setTimeout(scrollToHash, 120)
    return () => window.clearTimeout(t)
  }, [pathname])

  return <>{children}</>
}
