import { createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { beforeEach, describe, expect, it } from 'vitest'

import { useEpisodicMemoryStore } from './episodic-memory-store.ts'
import { insertLaunchedMemories, isPastDated } from './launch-stars.ts'

function existing(id: string): EpisodicMemory {
  return {
    id,
    name: id,
    emotion: createEmotion('CALM'),
    baseStrength: 0.5,
    recallCount: 0,
    createdUniverseTime: '2026-01-01',
    lastRecalledUniverseTime: null,
    seed: null,
    activations: [],
    decayStages: [],
    forgettingOffsetDays: 0,
  }
}

describe('isPastDated', () => {
  it('is true only when the diary date precedes a set universe time', () => {
    expect(isPastDated('2026-01-01', '2026-02-01')).toBe(true)
    expect(isPastDated('2026-02-01', '2026-02-01')).toBe(false)
    expect(isPastDated('2026-03-01', '2026-02-01')).toBe(false)
  })

  it('is never past in an empty universe (no clock yet)', () => {
    expect(isPastDated('2020-01-01', null)).toBe(false)
  })
})

describe('insertLaunchedMemories', () => {
  beforeEach(() => {
    useEpisodicMemoryStore.getState().setAll([existing('old')])
  })

  it('optimistically inserts one memory per returned id, memory-level only', () => {
    insertLaunchedMemories(
      [{ name: 'New memory', mood: 'JOY', neurons: [{ name: 'n1', type: 'entity' }] }],
      ['mem-1'],
      '2026-06-01',
    )
    const store = useEpisodicMemoryStore.getState()
    expect(store.ids).toEqual(['old', 'mem-1'])
    const inserted = store.byId['mem-1']
    expect(inserted?.name).toBe('New memory')
    expect(inserted?.emotion.mood).toBe('JOY')
    expect(inserted?.createdUniverseTime).toBe('2026-06-01')
    // Only the memory itself — neurons / synapses are server-decided and fill on the next read.
    expect(inserted?.activations).toEqual([])
  })

  it('inserts nothing for a past-dated launch (server returns no ids), leaving the store untouched', () => {
    insertLaunchedMemories([{ name: 'Kept', mood: 'SAD', neurons: [] }], [], '2020-01-01')
    expect(useEpisodicMemoryStore.getState().ids).toEqual(['old'])
  })

  it('appends only as many memories as the server returned ids', () => {
    insertLaunchedMemories(
      [
        { name: 'First', mood: 'JOY', neurons: [] },
        { name: 'Second', mood: 'SAD', neurons: [] },
      ],
      ['mem-1'],
      '2026-06-01',
    )
    expect(useEpisodicMemoryStore.getState().ids).toEqual(['old', 'mem-1'])
  })
})
