import { paletteById, setMoodPalette } from '@cosimosi/emotion'

import { usePalettePreferenceStore } from '../model/palette-preference-store.ts'

// Resolve an id through the registry and drive BOTH the render seam and the UI mirror in one step:
// setMoodPalette re-colors the universe through the single moodColor entry point, and the store
// updates the picker's selection. An unknown id resolves to the default (paletteById is fail-safe),
// so the universe is always colored by a real palette.
export function applyPalette(id: string): void {
  setMoodPalette(paletteById(id))
  usePalettePreferenceStore.getState().setPaletteId(id)
}
