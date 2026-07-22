import { create } from 'zustand'

import { DEFAULT_PALETTE_ID } from '@cosimosi/emotion'

export interface PalettePreferenceState {
  paletteId: string
  confirmedPaletteId: string
  setPaletteId: (id: string) => void
  setConfirmedPaletteId: (id: string) => void
  reset: () => void
}

// Data store (§3.2): the React-observable mirror of the current palette id — a plain scalar the
// picker reads to show the active choice, not machine context. The render seam (setMoodPalette) and
// this mirror are kept in step by the api's applyPalette, so the UI and the universe never disagree.
export const usePalettePreferenceStore = create<PalettePreferenceState>()((set) => ({
  paletteId: DEFAULT_PALETTE_ID,
  confirmedPaletteId: DEFAULT_PALETTE_ID,
  setPaletteId: (id) => set({ paletteId: id }),
  setConfirmedPaletteId: (id) => set({ confirmedPaletteId: id }),
  reset: () => set({ paletteId: DEFAULT_PALETTE_ID, confirmedPaletteId: DEFAULT_PALETTE_ID }),
}))
