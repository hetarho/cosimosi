import { useEffect, useLayoutEffect, useRef } from 'react'
import { advanceSweepFrame, type AdvanceInterval } from '../advance-interval.ts'
import {
  advanceSkyRate,
  advanceSkyRateFor,
  resetAdvanceSkyRate,
  useAdvanceSweepStore,
} from '../advance-sweep-store.ts'

// requestAnimationFrame exists on both web and React Native; the package compiles without the DOM
// lib, so the two globals it drives the sweep with are declared here.
declare function requestAnimationFrame(callback: (now: number) => void): number
declare function cancelAnimationFrame(handle: number): void

export interface AdvanceSweepInput {
  interval: AdvanceInterval
  // The platform's reduced-motion preference; under it the sweep is skipped, not slowed.
  reducedMotion: boolean
  /** Fires once per sampled date while the sweep runs — the widget hands it to the HUD. */
  onTick: (universeTime: string) => void
  onDone: () => void
}

// useAdvanceSweep drives the time-passing transition ([T2][V8][C8]), shared by both apps. Time passing
// happens to the PLACE, not to the screen, so the scene says it and this only drives it. Two channels
// leave here at two rates (see `advance-sweep-store`): every frame, how much faster the sky's own time
// runs, on the same 0 → 1 → 0 envelope; and on each new sampled date, the clock the SCENE projects at,
// which walks the stars' brightness down in front of the viewer.
//
// Presentation only: it plays after the data path already ran and can be skipped without losing
// anything. The per-frame math is `advanceSweepFrame`, computed off the rAF callback's own timestamp
// so the sweep is deterministic under fake timers. Per-frame values never enter React state; `onTick`
// fires only when the sampled date changes.
export function useAdvanceSweep({ interval, reducedMotion, onTick, onDone }: AdvanceSweepInput) {
  const callbacksRef = useRef({ onTick, onDone })
  useLayoutEffect(() => {
    callbacksRef.current = { onTick, onDone }
  })

  useEffect(() => {
    const sweep = useAdvanceSweepStore.getState()
    // Under reduced motion land on the final clock and let the scene read the committed one; the sweep
    // carried no information the settled frame does not already hold.
    if (reducedMotion) {
      callbacksRef.current.onTick(interval.current)
      callbacksRef.current.onDone()
      return
    }

    // The scene starts where the viewer last saw it — the clock before the advance — so walking the
    // sampled date forward never jumps a star's brightness backwards on the first frame.
    sweep.begin(interval.previous)
    let frame = 0
    let start: number | null = null
    let lastShown: string | null = null
    const step = (now: number) => {
      if (start === null) start = now
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
}
