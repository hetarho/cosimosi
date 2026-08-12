import { create } from 'zustand'

// How the viewer is holding the universe: `pinned` keeps it flat and centred on the stars, `free`
// lets it tumble in any direction. It is a VIEW PREFERENCE, not a lifecycle — there is no ordering
// between the two, nothing to enter or leave, and no event either one can refuse — so it lives in a
// store rather than in the navigation machine (§3.2), which owns travel and selection and would gain
// a second, unrelated axis of state if this rode along in it.
//
// The camera reads it inside the canvas and the HUD control writes it outside; both reach this module
// directly, because React context does not cross the R3F reconciler.

export type UniverseViewMode = 'pinned' | 'free'

export interface UniverseViewState {
  readonly mode: UniverseViewMode
  toggle: () => void
  choose: (mode: UniverseViewMode) => void
}

/**
 * `pinned` is the universe's resting shape: the two z-bands read as depth only while the horizon
 * holds still, so the flat view is what a person should arrive in. Free navigation is one press away
 * and stays for the rest of the visit.
 */
export const UNIVERSE_DEFAULT_VIEW_MODE: UniverseViewMode = 'pinned'

export const useUniverseViewStore = create<UniverseViewState>()((set) => ({
  mode: UNIVERSE_DEFAULT_VIEW_MODE,
  toggle: () => set((state) => ({ mode: state.mode === 'pinned' ? 'free' : 'pinned' })),
  choose: (mode) => set((state) => (state.mode === mode ? state : { mode })),
}))
