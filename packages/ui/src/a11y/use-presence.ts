import { useEffect, useState } from 'react'

export type PresencePhase = 'entering' | 'leaving'

export interface Presence {
  /** Whether the surface should be in the tree at all. Stays true through the leave. */
  readonly present: boolean
  /** Which way it is moving — the class or animation to apply while it is. */
  readonly phase: PresencePhase
}

/**
 * Keeps a surface mounted long enough to animate itself out.
 *
 * A component that returns `null` the moment it closes can only ever animate IN: the element the
 * animation would run on is already gone. This holds it for `exitMs` past the close, in a `leaving`
 * phase, and then drops it — so an exit animation has something to play on, and nothing lingers
 * afterwards. Reopening mid-leave cancels the leave rather than queueing a second one.
 *
 * `exitMs` must match the animation the caller applies, because this timer — not the animation — is
 * what unmounts. Under reduced motion the caller's animation collapses (base.css) while this still
 * waits out the timer: a surface that is already invisible for those few frames is not something a
 * reduced-motion user can perceive, and the alternative is a second source of truth for the duration.
 */
export function usePresence(open: boolean, exitMs: number): Presence {
  const [present, setPresent] = useState(open)
  const [phase, setPhase] = useState<PresencePhase>(open ? 'entering' : 'leaving')

  useEffect(() => {
    if (open) {
      setPresent(true)
      setPhase('entering')
      return
    }
    setPhase('leaving')
    const timer = setTimeout(() => setPresent(false), exitMs)
    return () => clearTimeout(timer)
  }, [open, exitMs])

  return { present: open || present, phase }
}
