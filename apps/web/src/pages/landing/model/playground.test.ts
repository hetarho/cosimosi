import { describe, expect, it } from 'vitest'

import { starChannels } from '@cosimosi/universe'

import {
  PLAYGROUND_EPOCH,
  PLAYGROUND_MAX_DAYS,
  playgroundMemory,
  playgroundUniverseTime,
  seedFromText,
  type PlaygroundEntry,
} from './playground.ts'

const entry = (overrides: Partial<PlaygroundEntry> = {}): PlaygroundEntry => ({
  text: 'walked home in the first snow',
  mood: 'CALM',
  recallCount: 0,
  lastRecalledDay: null,
  ...overrides,
})

describe('the playground clock', () => {
  it('starts at the epoch and counts civil days', () => {
    expect(playgroundUniverseTime(0)).toBe(PLAYGROUND_EPOCH)
    expect(playgroundUniverseTime(31)).toBe('2026-02-01')
    expect(playgroundUniverseTime(PLAYGROUND_MAX_DAYS)).toBe('2027-01-01')
  })
})

describe('the playground memory', () => {
  it('gives two different sentences two different seed-forms, and the same sentence the same one', () => {
    expect(seedFromText('a')).not.toEqual(seedFromText('b'))
    expect(playgroundMemory(entry()).seed).toEqual(playgroundMemory(entry()).seed)
  })

  // The section's whole claim is that the visitor watches the shipped behaviour, so the story's
  // three beats must actually come out of the production channel projection over this memory.
  it('dims with neglect and returns on recall, through the production channels', () => {
    const fresh = starChannels(playgroundMemory(entry()), playgroundUniverseTime(0))
    const neglected = starChannels(playgroundMemory(entry()), playgroundUniverseTime(300))
    expect(neglected.brightness).toBeLessThan(fresh.brightness)

    const recalled = starChannels(
      playgroundMemory(entry({ recallCount: 1, lastRecalledDay: 300 })),
      playgroundUniverseTime(300),
    )
    expect(recalled.brightness).toBeGreaterThan(neglected.brightness)
    expect(recalled.size).toBeGreaterThan(neglected.size)
  })
})
