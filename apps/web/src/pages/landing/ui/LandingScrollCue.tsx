import { useRef } from 'react'

import { useReducedMotion } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

/**
 * The way down, said without words — and now also the way to take it.
 *
 * It finds its own destination: the enclosing `<section>` is one screen of this page, so the bottom of
 * that section is the top of the next one, and the cue needs no target handed to it. That keeps it
 * droppable into any screen-sized section without the page threading a ref to each place it appears.
 *
 * A real button, not a decorated div: it moves the viewport, so it has to be reachable by keyboard and
 * has to say what it does. The bounce is `motion-safe`, and the jump itself falls back to an instant
 * scroll under reduced motion — a long smooth scroll is exactly the kind of motion the preference is
 * asking to be spared.
 */
export function LandingScrollCue({ className }: { readonly className?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const reducedMotion = useReducedMotion()

  const goDown = () => {
    const screen = ref.current?.closest('section')
    if (!screen) return
    window.scrollTo({
      top: screen.getBoundingClientRect().bottom + window.scrollY,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={goDown}
      aria-label={m.landing_scroll_cue()}
      className={
        'absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full p-2 text-text-subtle transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-safe:animate-bounce' +
        (className === undefined ? '' : ` ${className}`)
      }
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M3 6l5 5 5-5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
