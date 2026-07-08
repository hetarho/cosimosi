import { useEffect, useRef } from 'react'

import { useReducedMotion } from '@cosimosi/ui'
import { advanceSweepFrame, type AdvanceInterval } from '@cosimosi/universe'

export interface AccelerateTimeProps {
  interval: AdvanceInterval
  /** Fires once per sampled date while the sweep runs — the widget hands it to the HUD. */
  onTick: (universeTime: string) => void
  onDone: () => void
}

// The neutral time-passing transition ([T2]): a restrained dilation veil over the running scene
// while the HUD date sweeps previous → current. This is the reserved choreography slot ([V8][C8]) —
// the forgetting-dimming and gist-rising choreographies land beside the veil off the same interval;
// the transition's own content stays neutral. Presentation only: it plays after the data path
// (insert / invalidate) already ran and can be skipped without losing anything.
//
// The per-frame math (sampled date, veil envelope, completion) is shared with mobile via
// advanceSweepFrame, computed off the rAF callback's own timestamp — not performance.now() — so the
// sweep is deterministic under test fake timers and never mixes clock sources. Per-frame veil
// intensity writes go through a DOM ref, never React state (§3.2); onTick fires only when the
// sampled date changes (≤ maxDateSteps re-renders per sweep).
export function AccelerateTime({ interval, onTick, onDone }: AccelerateTimeProps) {
  const veilRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const callbacksRef = useRef({ onTick, onDone })
  callbacksRef.current = { onTick, onDone }

  useEffect(() => {
    if (reducedMotion) {
      callbacksRef.current.onTick(interval.current)
      callbacksRef.current.onDone()
      return
    }
    let frame = 0
    let start: number | null = null
    let lastShown: string | null = null
    const step = (now: number) => {
      if (start === null) start = now
      const { universeTime, veilIntensity, done } = advanceSweepFrame(interval, now - start)
      if (universeTime !== lastShown) {
        lastShown = universeTime
        callbacksRef.current.onTick(universeTime)
      }
      if (veilRef.current) veilRef.current.style.opacity = String(veilIntensity * VEIL_MAX_OPACITY)
      if (done) {
        callbacksRef.current.onDone()
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [interval, reducedMotion])

  return (
    <div
      ref={veilRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--color-bg)_100%)]"
      style={{ opacity: 0 }}
    />
  )
}

// Presentation constant (code-level, the camera-rig precedent): how deep the dilation dims the
// scene edge at the sweep's midpoint. Neutral space-tone from the theme var, never an emotion color.
const VEIL_MAX_OPACITY = 0.85
