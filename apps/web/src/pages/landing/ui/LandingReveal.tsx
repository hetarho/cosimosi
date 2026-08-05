import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { cx, tokens, useReducedMotion } from '@cosimosi/ui'

// The entrance moves at the product's pace: a section arriving is a surface crossing the screen,
// which is the slow token — Tailwind's numeric duration/ease utilities would restate the values.
const REVEAL_TIMING: CSSProperties = {
  transitionDuration: tokens.duration.slow,
  transitionTimingFunction: tokens.ease.standard,
}

/**
 * Sections arrive the way the page says memories do: they rise into place as the visitor reaches
 * them. One IntersectionObserver per section, disconnected after the first entrance — the reveal
 * happens once, on the way down, never again on the way back up.
 *
 * Reduced motion (or an environment without the observer, like a test DOM) renders everything in
 * place immediately: the animation is a flourish, never a gate in front of the content.
 */
export function LandingReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [reducedMotion])

  return (
    <div
      ref={ref}
      style={REVEAL_TIMING}
      className={cx(
        'transition-all',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
      )}
    >
      {children}
    </div>
  )
}
