import { useCallback } from 'react'

import type { Transport } from '@connectrpc/connect'
import { useTransport } from '@connectrpc/connect-query'

import { setPalettePreference } from '@cosimosi/api-client'

import { usePalettePreferenceStore } from '../model/palette-preference-store.ts'
import { applyPalette } from './apply-palette.ts'

// Persists are serialized module-wide: a selection's write is sent only after the previous one
// settles, so the server always converges on the LAST user intent. A component-local in-flight
// flag can't guarantee this — it dies with the screen, and two writes racing across a remount
// could resolve out of order, leaving the server on the older palette while the client shows the
// newer one (wrong color on next boot).
let persistQueue: Promise<void> = Promise.resolve()

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
  const send = persistQueue.then(() => setPalettePreference(transport, id))
  persistQueue = send.then(
    () => undefined,
    () => undefined,
  )
  try {
    const saved = await send
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
