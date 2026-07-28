import { create } from 'zustand'

// The sweep → scene seam. While an acceleration plays, the transition is a DOM sibling of the canvas
// and React context does not cross the R3F reconciler, so what the scene needs to know travels
// through here — the advance-announcement-store precedent, one module level up from either widget.
//
// It carries two things at two very different rates, and that is why they are two mechanisms:
//
//   The SAMPLED CLOCK is store state. It changes at most `maxDateSteps` times across a whole sweep
//   (the same quantized date the HUD flips through), so a subscriber re-rendering on it is a handful
//   of renders per acceleration — the budget the HUD already spends.
//
//   The SKY RATE is a plain mutable ref, written every frame. A per-frame value may never be React
//   state (§3.2); the sweep already writes its own envelope through a ref each frame, and the sky
//   reads this one inside its own `useFrame`, so no render happens at 60fps.

export interface AdvanceSweepState {
  /**
   * The clock the SCENE should project at while a sweep plays — the sampled date walking previous →
   * current — or null when nothing is playing and the committed read clock governs.
   *
   * This is what makes forgetting visible *during* the acceleration rather than discovered after it.
   * The stars' brightness is a function of this clock, so walking it forward walks them down: a
   * memory left alone for months quiets in front of the viewer instead of being found already quiet.
   */
  sampledTime: string | null
  /** A sweep began: the scene starts projecting at `previous` (or at the committed clock if none). */
  begin: (previous: string | null) => void
  /** The sweep reached a new sampled date. */
  tick: (universeTime: string) => void
  /** The sweep finished: the scene returns to the committed read clock. */
  end: () => void
  reset: () => void
}

export const useAdvanceSweepStore = create<AdvanceSweepState>()((set) => ({
  sampledTime: null,
  begin: (previous) => set({ sampledTime: previous }),
  tick: (universeTime) => set({ sampledTime: universeTime }),
  end: () => set({ sampledTime: null }),
  reset: () => set({ sampledTime: null }),
}))

/**
 * How much faster the sky's own time runs right now — 1 at rest, higher while an acceleration plays.
 *
 * Time passing is something that happens to the place, not to the screen, so the sky says it: its
 * recipe already reads a seconds uniform, and running that uniform fast is the whole effect. A
 * translucent sheet laid over the canvas would say a transition is happening to the viewer instead.
 *
 * A ref rather than store state because it is written on every frame of the sweep.
 */
export const advanceSkyRate: { current: number } = { current: 1 }

/** The sky's rate at the peak of a sweep. A beat, not a time-lapse — fast enough to read as time
 *  moving, slow enough that the backdrop stays the same sky throughout. */
export const ADVANCE_SKY_PEAK_RATE = 26

/** The sky's rate for a given point on the sweep's own envelope (`AdvanceSweepFrame.envelope`, which
 *  already runs 0 → 1 → 0), so the flow eases in and out instead of snapping on. */
export function advanceSkyRateFor(envelope: number): number {
  const clamped = Math.min(1, Math.max(0, envelope))
  return 1 + (ADVANCE_SKY_PEAK_RATE - 1) * clamped
}

/** Return the sky to rest. Called when a sweep ends, and by the user-scope reset. */
export function resetAdvanceSkyRate(): void {
  advanceSkyRate.current = 1
}
