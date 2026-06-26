// Evolution-overlay open state (spec 24). A minimal stand-in for spec 31's overlay shell
// (`panel='evolution'`) — which isn't built yet — so the timelapse opens OVER the live
// universe canvas (no route change, universe persists behind) from the recall panel's
// "변천사 보기". Pure (no three/DOM):
// zustand only — the recall feature triggers it via a page-wired callback (FSD: features
// don't import features; the page composes).
import { create } from 'zustand'

interface EvolutionState {
  /** The star whose evolution is open, or null when the overlay is closed. */
  openFor: string | null
  open: (memoryId: string) => void
  close: () => void
}

export const useEvolutionStore = create<EvolutionState>((set) => ({
  openFor: null,
  open: (memoryId) => set({ openFor: memoryId }),
  close: () => set({ openFor: null }),
}))
