import { useEffect, useRef } from 'react'

/**
 * Drives the hero mark's retreat from scroll position: the solid shrinks toward its own centre and
 * winks out, so leaving the first screen reads as the mark settling back into the sky it was standing
 * in front of.
 *
 * Written straight onto the element inside a rAF as two custom properties, never through React state
 * — scrolling this page re-renders nothing, the same contract the backdrop's veil holds.
 *
 * The two curves are separate on purpose. Scale runs almost the whole way down, and opacity holds near
 * full until the end before dropping fast: a mark that faded evenly as it shrank would be a smudge
 * thinning out, while one that stays bright while it gets small is a light going away from you. The
 * last thing on screen is a point, which is what the sky behind it is already full of.
 */
export function useMarkRecede<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    if (!enabled) {
      element.style.setProperty('--mark-scale', '1')
      element.style.setProperty('--mark-opacity', '1')
      return
    }

    let frame = 0
    const apply = () => {
      frame = 0
      // Shorter than the hero is tall, so the retreat finishes while the mark is still on screen —
      // over a full viewport it would simply scroll away before anything happened to it.
      const runway = Math.max(1, window.innerHeight * 0.62)
      const progress = Math.min(1, Math.max(0, window.scrollY / runway))
      element.style.setProperty('--mark-scale', (1 - progress * 0.9).toFixed(3))
      element.style.setProperty('--mark-opacity', (1 - progress ** 3).toFixed(3))
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
  }, [enabled])

  return ref
}
