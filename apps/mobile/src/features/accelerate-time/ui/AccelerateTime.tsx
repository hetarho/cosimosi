import { useEffect, useRef } from 'react'

import { useReducedMotion } from '@cosimosi/ui'
import {
  advanceSkyRate,
  advanceSkyRateFor,
  advanceSweepFrame,
  resetAdvanceSkyRate,
  useAdvanceSweepStore,
  type AdvanceInterval,
} from '@cosimosi/universe'

export interface AccelerateTimeProps {
  interval: AdvanceInterval
  /** Fires once per sampled date while the sweep runs — the widget hands it to the HUD. */
  onTick: (universeTime: string) => void
  onDone: () => void
}

// The time-passing transition ([T2][V8][C8]) — and on this platform it is no longer a fork. The web
// side once drove a DOM layer and this one an Animated.View, because both were rendering a veil; now
// that the SCENE says time is passing, both hosts write the same two channels and render nothing, so
// the two files differ only in their imports (§3.5 — the parity is real rather than mirrored).
//
// Every frame it writes how much faster the sky's own time should run, on the sweep's own 0 → 1 → 0
// envelope; on each new sampled date it publishes the clock the scene projects at, which walks the
// stars' brightness down in front of the viewer. One rAF loop is now enough: there is no native-driver
// animation left to keep off the JS thread, and the values it writes are read inside the canvas's own
// frame loop rather than by React.
export function AccelerateTime({ interval, onTick, onDone }: AccelerateTimeProps) {
  const reducedMotion = useReducedMotion()
  const callbacksRef = useRef({ onTick, onDone })
  callbacksRef.current = { onTick, onDone }

  useEffect(() => {
    const sweep = useAdvanceSweepStore.getState()
    if (reducedMotion) {
      callbacksRef.current.onTick(interval.current)
      callbacksRef.current.onDone()
      return
    }

    // The scene starts where the viewer last saw it, so no star's brightness jumps backwards.
    sweep.begin(interval.previous)
    let frame = 0
    let start: number | null = null
    let lastShown: string | null = null
    const step = (now: number) => {
      if (start === null) {
        start = now
      }
      const { universeTime, envelope, done } = advanceSweepFrame(interval, now - start)
      advanceSkyRate.current = advanceSkyRateFor(envelope)
      if (universeTime !== lastShown) {
        lastShown = universeTime
        sweep.tick(universeTime)
        callbacksRef.current.onTick(universeTime)
      }
      if (done) {
        resetAdvanceSkyRate()
        sweep.end()
        callbacksRef.current.onDone()
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      // An unmount mid-sweep must not leave the sky racing or the scene stuck on a sampled clock.
      resetAdvanceSkyRate()
      useAdvanceSweepStore.getState().end()
    }
  }, [interval, reducedMotion])

  return null
}
