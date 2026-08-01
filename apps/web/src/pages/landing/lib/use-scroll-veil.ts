import { useEffect, useRef } from 'react'

/**
 * Drives the backdrop veil from scroll position: writes the page's scroll progress through the
 * first viewport into the element's `--veil` custom property (0 at the top, 1 once the hero has
 * scrolled past). The value goes straight onto the element inside a rAF — never through React
 * state — so scrolling re-renders nothing.
 */
export function useScrollVeil<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let frame = 0
    const apply = () => {
      frame = 0
      // Fully veiled at ~90% of a viewport: the blur finishes settling just as the first content
      // section arrives, so reading never happens over a half-sharpened sky.
      const runway = Math.max(1, window.innerHeight * 0.9)
      const progress = Math.min(1, Math.max(0, window.scrollY / runway))
      element.style.setProperty('--veil', progress.toFixed(3))
    }
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(apply)
    }

    apply()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [])

  return ref
}
