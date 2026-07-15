import { useCallback } from 'react'

import type { Transport } from '@connectrpc/connect'
import { useTransport } from '@connectrpc/connect-query'

import { setPalettePreference } from '@cosimosi/api-client'

import { usePalettePreferenceStore } from '../model/palette-preference-store.ts'
import { applyPalette } from './apply-palette.ts'

// Set-and-apply: re-color optimistically first (instant visual through setMoodPalette), then persist
// the id. If the persist fails, revert to the previously-stored id and re-apply — the running
// universe never lingers on a color the server did not accept. The live re-color needs no
// GetUniverse refetch: only the active palette changed, and the canvas re-reads moodColor on the
// palette-version nudge. This is the path the settings picker calls.
export async function changePalette(transport: Transport, id: string): Promise<void> {
  const previous = usePalettePreferenceStore.getState().paletteId
  applyPalette(id)
  // A later change supersedes this one: only touch the palette again while THIS id is still the
  // active choice, so a slow/failed request never clobbers a newer selection made meanwhile.
  const stillCurrent = () => usePalettePreferenceStore.getState().paletteId === id
  try {
    const saved = await setPalettePreference(transport, id)
    // The server echoes the id it kept; keep the seam in step if it differs (it never should — an
    // unknown id is rejected before this resolves).
    if (saved.paletteId !== id && stillCurrent()) {
      applyPalette(saved.paletteId)
    }
  } catch (error) {
    if (stillCurrent()) {
      applyPalette(previous)
    }
    throw error
  }
}

// The hook the settings picker uses: it binds the live transport from context; the logic lives in
// changePalette so it stays testable without a React harness. Stable identity for effect deps.
export function useChangePalette(): (id: string) => Promise<void> {
  const transport = useTransport()
  return useCallback((id: string) => changePalette(transport, id), [transport])
}
