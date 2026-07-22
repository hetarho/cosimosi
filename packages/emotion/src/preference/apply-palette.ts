import { setMoodPalette } from '../palette.ts'
import { resolvePaletteById } from '../registry.ts'

import { usePalettePreferenceStore } from './palette-preference-store.ts'

// Resolve an id through the registry and drive BOTH the render seam and the UI mirror in one step:
// setMoodPalette re-colors the universe through the single moodColor entry point, and the store
// updates the picker's selection. An unknown id resolves to the default (paletteById is fail-safe),
// so the universe is always colored by a real palette.
export function applyPalette(id: string): string {
  const resolved = resolvePaletteById(id)
  setMoodPalette(resolved.palette)
  usePalettePreferenceStore.getState().setPaletteId(resolved.id)
  return resolved.id
}

export function applyConfirmedPalette(id: string): string {
  const canonicalId = applyPalette(id)
  usePalettePreferenceStore.getState().setConfirmedPaletteId(canonicalId)
  return canonicalId
}
