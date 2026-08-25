import { beforeEach, describe, expect, it } from 'vitest'

import type { EpisodicMemory } from '@cosimosi/memory'

import { useEpisodicMemoryStore } from './episodic-memory-store.ts'

// The projection and every other reader take the stage from here; only these fields matter to the
// one-way rule under test.
function memory(id: string, semanticStage: number, name = id): EpisodicMemory {
  return {
    id,
    diaryId: `diary-${id}`,
    name,
    emotion: { mood: 'JOY', valence: 0.8, arousal: 0.6, intensity: 0.5 },
    baseStrength: 0.5,
    recallCount: 0,
    createdUniverseTime: '2026-01-01',
    lastRecalledUniverseTime: null,
    seed: 1,
    activations: [],
    decayStages: [],
    forgettingOffsetDays: 0,
    currentText: id,
    semanticStage,
  } as unknown as EpisodicMemory
}

describe('episodic memory store', () => {
  beforeEach(() => useEpisodicMemoryStore.getState().clear())

  it('holds a semantic stage at its high-water mark when a stale read reports lower', () => {
    const { setAll } = useEpisodicMemoryStore.getState()
    setAll([memory('alpha', 2)])
    // A refetch racing a fresh one comes back a rung behind. A stage is one-way ([C6a]), so this is
    // a stale response, not a memory that un-rose.
    setAll([memory('alpha', 1)])

    expect(useEpisodicMemoryStore.getState().byId.alpha?.semanticStage).toBe(2)
  })

  it('keeps the previous references when a response differs only by a lower stage', () => {
    const { setAll } = useEpisodicMemoryStore.getState()
    setAll([memory('alpha', 3)])
    const { byId, ids } = useEpisodicMemoryStore.getState()

    setAll([memory('alpha', 1)])

    // The guard runs before the content comparison, so this is recognized as no change at all —
    // every consumer memoized on these references is left alone rather than re-projecting.
    expect(useEpisodicMemoryStore.getState().byId).toBe(byId)
    expect(useEpisodicMemoryStore.getState().ids).toBe(ids)
  })

  it('still raises a stage, and still takes every other field from the fresh read', () => {
    const { setAll } = useEpisodicMemoryStore.getState()
    setAll([memory('alpha', 1, 'first name')])
    setAll([memory('alpha', 3, 'renamed')])

    const risen = useEpisodicMemoryStore.getState().byId.alpha
    expect(risen?.semanticStage).toBe(3)
    expect(risen?.name).toBe('renamed')

    // A lower stage holds the floor without discarding the rest of the fresher row.
    setAll([memory('alpha', 2, 'renamed again')])
    const held = useEpisodicMemoryStore.getState().byId.alpha
    expect(held?.semanticStage).toBe(3)
    expect(held?.name).toBe('renamed again')
  })

  it('holds each memory independently and leaves unrelated ones untouched', () => {
    const { setAll } = useEpisodicMemoryStore.getState()
    setAll([memory('alpha', 3), memory('beta', 1)])
    setAll([memory('alpha', 1), memory('beta', 2)])

    const { byId } = useEpisodicMemoryStore.getState()
    expect(byId.alpha?.semanticStage).toBe(3)
    expect(byId.beta?.semanticStage).toBe(2)
  })

  it('releases the floor with the collection, so the next universe starts from nothing', () => {
    const { setAll, clear } = useEpisodicMemoryStore.getState()
    setAll([memory('alpha', 4)])
    clear()
    // A different account's universe (or a replayed staged scene) must not inherit a stage.
    setAll([memory('alpha', 1)])

    expect(useEpisodicMemoryStore.getState().byId.alpha?.semanticStage).toBe(1)
  })

  it('does not invent a stage for a memory it has never mirrored', () => {
    useEpisodicMemoryStore.getState().setAll([memory('alpha', 2)])

    expect(useEpisodicMemoryStore.getState().byId.alpha?.semanticStage).toBe(2)
  })
})
