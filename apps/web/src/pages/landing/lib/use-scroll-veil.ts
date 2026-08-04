import { useEffect, useRef, type RefObject } from 'react'

/**
 * Drives the backdrop veil from scroll position, writing the result into the element's `--veil`
 * custom property (0 bare, 1 fully veiled). The value goes straight onto the element inside a rAF —
 * never through React state — so scrolling re-renders nothing.
 *
 * The curve is not monotonic, and that is the design. It RISES as the hero leaves, so the blurred night
 * becomes the surface the walkthrough's controls sit on — which is the only thing marking that screen
 * as its own room. It FALLS again as `clearAnchor` finishes leaving, because the argument is over by
 * then: the sky comes back, and the glass panels below finally have something moving behind them to be
 * glass in front of.
 */
export function useScrollVeil<T extends HTMLElement>(clearAnchor?: RefObject<HTMLElement | null>) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let frame = 0
    const apply = () => {
      frame = 0
      const viewport = Math.max(1, window.innerHeight)
      // Fully veiled at ~90% of a viewport: the blur finishes settling just as the first content
      // section arrives, so reading never happens over a half-sharpened sky.
      const rise = Math.min(1, Math.max(0, window.scrollY / (viewport * 0.9)))

      // Driven by the anchor's BOTTOM edge, not its centre: the anchor is a screen-tall section, and a
      // centre would start clearing the sky while the visitor is still working through it. Measured
      // rather than counted in scroll distance, so it tracks the section wherever the content above
      // pushes it to. The clearing runs over the last half-viewport of the screen, so it completes as
      // the boundary passes and the invitation at the bottom is the last thing seen through the blur.
      const anchor = clearAnchor?.current
      let clear = 0
      if (anchor) {
        const remaining = anchor.getBoundingClientRect().bottom
        clear = Math.min(1, Math.max(0, 1 - remaining / (viewport * 0.5)))
      }

      element.style.setProperty('--veil', (rise * (1 - clear)).toFixed(3))
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
  }, [clearAnchor])

  return ref
}
