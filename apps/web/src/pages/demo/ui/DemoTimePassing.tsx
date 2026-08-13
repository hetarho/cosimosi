import { useEffect, useRef } from 'react'

import { useReducedMotion } from '@cosimosi/ui'
import {
  advanceSkyRate,
  advanceSkyRateFor,
  advanceSweepFrame,
  resetAdvanceSkyRate,
  type AdvanceInterval,
} from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

// pages/demo ui: the demo-local presentation of universe time passing — the product's
// `UniverseTimeOverlay` stays on the never-mount list (it is wired to the advance-announcement and
// consent stores this page must not reach), so the demo renders its own equivalent from the same
// pure seams: `advanceSweepFrame` samples the dates, `advanceSkyRate` makes the backdrop flow.
// Time arrives as something that happens to the PLACE — the sampled clock walks the stars'
// brightness down in front of the viewer — never as a bare date-string swap.

export interface DemoTimeAdvanceProps {
  readonly interval: AdvanceInterval
  /** Fires per sampled date; the page hands it to the scene and the HUD. */
  readonly onTick: (universeTime: string) => void
  readonly onDone: () => void
}

// Renderless driver, modeled on the product's `AccelerateTime`: the per-frame math is the shared
// `advanceSweepFrame`, computed off the rAF callback's own timestamp so the sweep never mixes
// clock sources. The one deliberate difference: the sampled date travels through the page's own
// state rather than the product's sweep store — the demo's scene reads props, not the store seam.
export function DemoTimeAdvance({ interval, onTick, onDone }: DemoTimeAdvanceProps) {
  const reducedMotion = useReducedMotion()
  const callbacksRef = useRef({ onTick, onDone })
  callbacksRef.current = { onTick, onDone }

  useEffect(() => {
    // Under reduced motion the transition is skipped, not slowed: land on the final clock and let
    // the scene read the committed one. The sweep carries nothing the settled frame does not hold.
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
      const { universeTime, envelope, done } = advanceSweepFrame(interval, now - start)
      advanceSkyRate.current = advanceSkyRateFor(envelope)
      if (universeTime !== lastShown) {
        lastShown = universeTime
        callbacksRef.current.onTick(universeTime)
      }
      if (done) {
        resetAdvanceSkyRate()
        callbacksRef.current.onDone()
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      // An unmount mid-sweep must not leave the sky racing.
      resetAdvanceSkyRate()
    }
  }, [interval, reducedMotion])

  return null
}

// The persistent clock, in the product HUD's shape ([T6]): a label and a value, and no control —
// the reading itself can do nothing to the time it reports. Bare type rather than a chip, because a
// surface behind it makes the one reading that belongs to the PLACE look like another control in the
// chrome; the sky is what it is written on, and legibility over a bright nebula comes from a shadow
// on the glyphs instead of a panel under them.
export function DemoTimeHud({ date }: { readonly date: string }) {
  return (
    <div className="pointer-events-none flex items-baseline gap-2 drop-shadow-md">
      <span className="text-xs text-text-muted">{m.demo_time_hud_label()}</span>
      <span className="text-sm tabular-nums text-text">{date}</span>
    </div>
  )
}
