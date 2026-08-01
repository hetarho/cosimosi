import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cx, useReducedMotion } from '@cosimosi/ui'

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
      className={cx(
        'transition-all duration-700 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
      )}
    >
      {children}
    </div>
  )
}
