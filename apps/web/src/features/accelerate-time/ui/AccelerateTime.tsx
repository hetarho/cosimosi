import { useReducedMotion } from '@cosimosi/ui'
import type { AdvanceInterval } from '@cosimosi/universe'
import { useAdvanceSweep } from '@cosimosi/universe/react'

export interface AccelerateTimeProps {
  interval: AdvanceInterval
  /** Fires once per sampled date while the sweep runs — the widget hands it to the HUD. */
  onTick: (universeTime: string) => void
  onDone: () => void
}

// The time-passing transition ([T2][V8][C8]). It renders nothing: time passing is something that
// happens to the PLACE, not to the screen, so the scene says it and this component only drives it.
//
// Two channels leave here, at two rates (see `advance-sweep-store`). Every frame it writes how much
// faster the sky's own time should run, on the same 0 → 1 → 0 envelope, so the backdrop flows and
// eases back to rest — that is the whole visual of the acceleration. And on each new sampled date it
// publishes the clock the SCENE should project at, which walks the stars' brightness down in front of
// the viewer: forgetting becomes something watched rather than something discovered afterwards.
//
// A translucent sheet over the canvas used to stand in for all of this. It read as a transition
// happening to the viewer, and it hid the very consequences the acceleration exists to show.
//
// Presentation only: it plays after the data path (insert / invalidate) already ran and can be
// skipped without losing anything. The per-frame math is shared with mobile via `advanceSweepFrame`,
// computed off the rAF callback's own timestamp — not `performance.now()` — so the sweep is
// deterministic under test fake timers and never mixes clock sources. Per-frame values go through
// refs, never React state (§3.2); `onTick` fires only when the sampled date changes (≤ maxDateSteps
// re-renders per sweep).
export function AccelerateTime({ interval, onTick, onDone }: AccelerateTimeProps) {
  useAdvanceSweep({ interval, reducedMotion: useReducedMotion(), onTick, onDone })
  return null
}
