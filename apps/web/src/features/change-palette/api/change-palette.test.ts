import { createRouterTransport } from '@connectrpc/connect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
import { applyConfirmedPalette, applyPalette } from './apply-palette.ts'
import { changePalette, PaletteSessionChangedError, resetPaletteSession } from './change-palette.ts'
import { readPalettePreference } from './read-palette-preference.ts'

const ALT_ID = 'muted-dusk'
const TEST_SCOPE = 'user-a'

// A stored memory fact — only the emotion fields drive the projected color; a swap must never move
// any of them (nor strength/position, which are absent here and derived elsewhere).
const memoryFact = { mood: 'JOY' as Mood, valence: 0.82, arousal: 0.72, intensity: 0.7 }

beforeEach(() => {
  resetPaletteSession(TEST_SCOPE)
})

afterEach(() => {
  resetMoodPalette()
  usePalettePreferenceStore.getState().reset()
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
    expect(usePalettePreferenceStore.getState().paletteId).toBe(DEFAULT_PALETTE_ID)
  })

  it('set-and-apply re-colors optimistically and persists the id (A7)', async () => {
    let received: string | undefined
    const transport = createAccountMockTransport({
      setPalettePreference(request) {
        received = request.paletteId
        return { paletteId: request.paletteId }
      },
    })

    await changePalette(transport, ALT_ID, TEST_SCOPE)

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

    await expect(changePalette(transport, ALT_ID, TEST_SCOPE)).rejects.toThrow()

    // Reverted: the running universe does not linger on the unsaved color.
    expect(moodColor('JOY')).toBe(defaultMoodPalette.colors.JOY)
    expect(usePalettePreferenceStore.getState().paletteId).toBe(DEFAULT_PALETTE_ID)
  })

  it('reverts to a non-default previous choice on persist failure', async () => {
    applyConfirmedPalette(ALT_ID)
    const transport = createAccountMockTransport({
      setPalettePreference() {
        throw new Error('server refused')
      },
    })

    await expect(changePalette(transport, DEFAULT_PALETTE_ID, TEST_SCOPE)).rejects.toThrow()

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

  it('serializes persists so the server converges on the last selection across remounts', async () => {
    const sent: string[] = []
    let releaseFirst = () => {}
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const transport = createRouterTransport(({ service }) => {
      service(AccountService, {
        async setPalettePreference(request) {
          sent.push(request.paletteId)
          // The first write hangs (a slow server); a later selection must not overtake it.
          if (sent.length === 1) await firstBlocked
          return { paletteId: request.paletteId }
        },
      })
    })

    const first = changePalette(transport, ALT_ID, TEST_SCOPE)
    const second = changePalette(transport, DEFAULT_PALETTE_ID, TEST_SCOPE)
    // Only the first write is sent — the second waits for it to settle, so the server can
    // never apply them out of order (the picker's local pending flag dies with the screen; this
    // ordering must hold at the api).
    await vi.waitFor(() => expect(sent).toEqual([ALT_ID]))
    releaseFirst()
    await Promise.all([first, second])

    expect(sent).toEqual([ALT_ID, DEFAULT_PALETTE_ID])
    expect(usePalettePreferenceStore.getState().paletteId).toBe(DEFAULT_PALETTE_ID)
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

    await changePalette(transport, ALT_ID, TEST_SCOPE)

    expect(universeReads).toBe(0)
  })

  it('rolls two rapid failures back to the last server-confirmed palette', async () => {
    applyConfirmedPalette(ALT_ID)
    const transport = createAccountMockTransport({
      setPalettePreference() {
        throw new Error('server refused')
      },
    })

    const first = changePalette(transport, DEFAULT_PALETTE_ID, TEST_SCOPE)
    const second = changePalette(transport, DEFAULT_PALETTE_ID, TEST_SCOPE)

    await expect(first).rejects.toThrow()
    await expect(second).rejects.toThrow()
    expect(usePalettePreferenceStore.getState()).toMatchObject({
      paletteId: ALT_ID,
      confirmedPaletteId: ALT_ID,
    })
  })

  it('uses a superseded success as canonical rollback truth for the latest failure', async () => {
    let calls = 0
    const transport = createAccountMockTransport({
      setPalettePreference(request) {
        calls += 1
        if (calls === 2) throw new Error('second write failed')
        return { paletteId: request.paletteId }
      },
    })

    const first = changePalette(transport, ALT_ID, TEST_SCOPE)
    const second = changePalette(transport, DEFAULT_PALETTE_ID, TEST_SCOPE)

    await first
    await expect(second).rejects.toThrow()
    expect(usePalettePreferenceStore.getState()).toMatchObject({
      paletteId: ALT_ID,
      confirmedPaletteId: ALT_ID,
    })
  })

  it('canonicalizes an unknown server echo in both confirmed and displayed state', async () => {
    const transport = createAccountMockTransport({
      setPalettePreference() {
        return { paletteId: 'retired-palette' }
      },
    })

    await changePalette(transport, ALT_ID, TEST_SCOPE)

    expect(usePalettePreferenceStore.getState()).toMatchObject({
      paletteId: DEFAULT_PALETTE_ID,
      confirmedPaletteId: DEFAULT_PALETTE_ID,
    })
    expect(moodColor('JOY')).toBe(defaultMoodPalette.colors.JOY)
  })

  it('cancels queued writes before dispatch when the session epoch changes', async () => {
    const sent: string[] = []
    let releaseFirst = () => {}
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const transport = createRouterTransport(({ service }) => {
      service(AccountService, {
        async setPalettePreference(request) {
          sent.push(request.paletteId)
          await firstBlocked
          return { paletteId: request.paletteId }
        },
      })
    })

    const settling = changePalette(transport, ALT_ID, TEST_SCOPE)
    const queued = changePalette(transport, DEFAULT_PALETTE_ID, TEST_SCOPE)
    const settlingResult = settling.then(
      () => null,
      (error: unknown) => error,
    )
    const queuedResult = queued.then(
      () => null,
      (error: unknown) => error,
    )
    await vi.waitFor(() => expect(sent).toEqual([ALT_ID]))

    resetPaletteSession('user-b')
    releaseFirst()

    expect(await settlingResult).toBeInstanceOf(PaletteSessionChangedError)
    expect(await queuedResult).toBeInstanceOf(PaletteSessionChangedError)
    expect(sent).toEqual([ALT_ID])
  })

  it('ignores a late A response after B has confirmed its own palette', async () => {
    let aStarted = false
    let releaseA = () => {}
    const blockedA = new Promise<void>((resolve) => {
      releaseA = resolve
    })
    const transportA = createRouterTransport(({ service }) => {
      service(AccountService, {
        async setPalettePreference() {
          aStarted = true
          await blockedA
          return { paletteId: DEFAULT_PALETTE_ID }
        },
      })
    })
    const lateA = changePalette(transportA, ALT_ID, TEST_SCOPE)
    const lateAResult = lateA.then(
      () => null,
      (error: unknown) => error,
    )
    await vi.waitFor(() => expect(aStarted).toBe(true))

    resetPaletteSession('user-b')
    const transportB = createAccountMockTransport({
      setPalettePreference(request) {
        return { paletteId: request.paletteId }
      },
    })
    await changePalette(transportB, ALT_ID, 'user-b')
    releaseA()

    expect(await lateAResult).toBeInstanceOf(PaletteSessionChangedError)
    expect(usePalettePreferenceStore.getState()).toMatchObject({
      paletteId: ALT_ID,
      confirmedPaletteId: ALT_ID,
    })
  })
})
