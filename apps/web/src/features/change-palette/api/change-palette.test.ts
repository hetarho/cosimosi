import { createRouterTransport } from '@connectrpc/connect'
import { afterEach, describe, expect, it } from 'vitest'

import { AccountService, MemoryService, createAccountMockTransport } from '@cosimosi/api-client'
import {
  DEFAULT_PALETTE_ID,
  PALETTES,
  defaultMoodPalette,
  moodColor,
  resetMoodPalette,
  type Mood,
} from '@cosimosi/emotion'

import { usePalettePreferenceStore } from '../model/palette-preference-store.ts'
import { applyPalette } from './apply-palette.ts'
import { changePalette } from './change-palette.ts'
import { readPalettePreference } from './read-palette-preference.ts'

const ALT_ID = 'muted-dusk'

// A stored memory fact — only the emotion fields drive the projected color; a swap must never move
// any of them (nor strength/position, which are absent here and derived elsewhere).
const memoryFact = { mood: 'JOY' as Mood, valence: 0.82, arousal: 0.72, intensity: 0.7 }

afterEach(() => {
  resetMoodPalette()
  usePalettePreferenceStore.getState().setPaletteId(DEFAULT_PALETTE_ID)
})

describe('features/change-palette api', () => {
  it('applyPalette re-colors through moodColor and updates the mirror', () => {
    applyPalette(ALT_ID)

    expect(moodColor('JOY')).toBe(PALETTES[ALT_ID].colors.JOY)
    expect(usePalettePreferenceStore.getState().paletteId).toBe(ALT_ID)
  })

  it('applyPalette falls back to the default palette for an unknown id', () => {
    applyPalette('not-a-real-palette')

    expect(moodColor('JOY')).toBe(defaultMoodPalette.colors.JOY)
  })

  it('set-and-apply re-colors optimistically and persists the id (A7)', async () => {
    let received: string | undefined
    const transport = createAccountMockTransport({
      setPalettePreference(request) {
        received = request.paletteId
        return { paletteId: request.paletteId }
      },
    })

    await changePalette(transport, ALT_ID)

    expect(received).toBe(ALT_ID)
    expect(moodColor('JOY')).toBe(PALETTES[ALT_ID].colors.JOY)
    expect(usePalettePreferenceStore.getState().paletteId).toBe(ALT_ID)
  })

  it('reverts to the previously-stored id and re-applies when the persist fails (A7)', async () => {
    const transport = createAccountMockTransport({
      setPalettePreference() {
        throw new Error('server refused')
      },
    })

    await expect(changePalette(transport, ALT_ID)).rejects.toThrow()

    // Reverted: the running universe does not linger on the unsaved color.
    expect(moodColor('JOY')).toBe(defaultMoodPalette.colors.JOY)
    expect(usePalettePreferenceStore.getState().paletteId).toBe(DEFAULT_PALETTE_ID)
  })

  it('reverts to a non-default previous choice on persist failure', async () => {
    applyPalette(ALT_ID)
    const transport = createAccountMockTransport({
      setPalettePreference() {
        throw new Error('server refused')
      },
    })

    await expect(changePalette(transport, DEFAULT_PALETTE_ID)).rejects.toThrow()

    expect(moodColor('JOY')).toBe(PALETTES[ALT_ID].colors.JOY)
    expect(usePalettePreferenceStore.getState().paletteId).toBe(ALT_ID)
  })

  it('readPalettePreference returns the stored id', async () => {
    const transport = createAccountMockTransport({
      getPalettePreference: () => ({ paletteId: ALT_ID }),
    })

    expect(await readPalettePreference(transport)).toBe(ALT_ID)
  })

  it('a swap re-colors through moodColor while the memory fact is byte-unchanged (A9)', () => {
    const snapshot = structuredClone(memoryFact)
    const before = moodColor(memoryFact.mood)

    applyPalette(ALT_ID)
    const after = moodColor(memoryFact.mood)

    // The projected color moved with the palette...
    expect(after).not.toBe(before)
    expect(after).toBe(PALETTES[ALT_ID].colors.JOY)
    // ...but the stored emotion fact (mood/valence/arousal) did not — the swap is a projection
    // change, never a change to the memory it projects ([I11][I3]).
    expect(memoryFact).toEqual(snapshot)
  })

  it('a swap fires no GetUniverse read — only the palette changed (A7)', async () => {
    let universeReads = 0
    const transport = createRouterTransport(({ service }) => {
      service(AccountService, {
        setPalettePreference: (request) => ({ paletteId: request.paletteId }),
      })
      service(MemoryService, {
        getUniverse() {
          universeReads += 1
          return {}
        },
      })
    })

    await changePalette(transport, ALT_ID)

    expect(universeReads).toBe(0)
  })
})
