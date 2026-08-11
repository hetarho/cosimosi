import { create } from 'zustand'

// The universe's answer to "these ones, right now" (§3.2 data): a cross-route action names a handful
// of episodic memories, and the scene holds the rest of the sky back so they can be seen. It is the
// sibling of `pending-fly-target-store` — the camera goes there, and this is what makes arriving
// legible: a glide toward one anonymous star inside a settling universe reads as a page load.
//
// Ids only. No coordinate, no `three` type, no camera: which stars matter is the app's to say, and
// how a scene shows that is the renderer's.

export interface SpotlightState {
  /** The `EpisodicMemory` ids the sky is holding still for, or none. */
  readonly memoryIds: readonly string[]
  spotlight: (memoryIds: readonly string[]) => void
  clear: () => void
}

const NONE: readonly string[] = []

export const useSpotlightStore = create<SpotlightState>()((set) => ({
  memoryIds: NONE,
  spotlight: (memoryIds) => set({ memoryIds: memoryIds.length > 0 ? [...memoryIds] : NONE }),
  clear: () => set((state) => (state.memoryIds === NONE ? state : { memoryIds: NONE })),
}))

/**
 * The fraction of its light the scene keeps while a spotlight holds. It rides the renderer's
 * EXPOSURE — the multiplier the tone curve reads before mapping light onto the display — so the
 * whole frame goes down as less light rather than as a grey wash, hues holding as they descend.
 *
 * Low enough that the lifted bodies are unmistakably the subject; not zero, because the universe has
 * to still be visibly there for them to be the subject OF something.
 */
export const SPOTLIGHT_SCENE_DIM = 0.22

/**
 * What a spotlit memory's brightness channel is multiplied by. It composes with the dim rather than
 * fighting it — both act before the tone curve, so a spotlit body lands near the top of the curve
 * while everything around it sits near the bottom.
 *
 * Chosen just high enough to reach that top: pushed further, the curve has no headroom left to give
 * and the extra light is spent desaturating the body toward white — which would trade away the
 * emotion colour it exists to carry ([I3]).
 */
export const SPOTLIGHT_STAR_LIFT = 4

/** How long the sky stays held after the spotlight is armed. Long enough to find the memories the
 *  camera flew to, short enough that it never becomes the state the universe is in. */
export const SPOTLIGHT_HOLD_SECONDS = 4.5

/** Exponential-damping rate for the fade in and out — a fade, not a switch. */
export const SPOTLIGHT_FADE_LAMBDA = 3.4
