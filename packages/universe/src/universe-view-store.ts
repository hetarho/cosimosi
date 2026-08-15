import { create } from 'zustand'

// How the viewer is holding the universe: `pinned` keeps it flat and centred on the stars, `free`
// lets it tumble in any direction. It is a VIEW PREFERENCE, not a lifecycle — there is no ordering
// between the two, nothing to enter or leave, and no event either one can refuse — so it lives in a
// store rather than in the navigation machine (§3.2), which owns travel and selection and would gain
// a second, unrelated axis of state if this rode along in it.
//
// The camera reads it inside the canvas and the HUD control writes it outside; both reach this module
// directly, because React context does not cross the R3F reconciler.
//
// This choice belongs to the device, not to an account. It deliberately survives sign-out and account
// switches, unlike user-owned mirrors and flow drafts cleared by `resetUniverseUserState`.

export type UniverseViewMode = 'pinned' | 'free'

export interface UniverseViewState {
  readonly mode: UniverseViewMode
  toggle: () => void
  choose: (mode: UniverseViewMode) => void
}

/**
 * `pinned` is the universe's resting shape: the two z-bands read as depth only while the horizon
 * holds still, so the flat view is what a fresh device should arrive in. Free navigation is one press
 * away and remains the runtime's device-side preference across route changes and account switches.
 * A reload or app restart starts a fresh runtime in the pinned mode again.
 */
export const UNIVERSE_DEFAULT_VIEW_MODE: UniverseViewMode = 'pinned'

export const useUniverseViewStore = create<UniverseViewState>()((set) => ({
  mode: UNIVERSE_DEFAULT_VIEW_MODE,
  toggle: () => set((state) => ({ mode: state.mode === 'pinned' ? 'free' : 'pinned' })),
  choose: (mode) => set((state) => (state.mode === mode ? state : { mode })),
}))
