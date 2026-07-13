import { describe, expect, it, beforeEach } from 'vitest'

import type { RecallResponse } from '@cosimosi/api-client'
import { createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'

import { useEpisodicMemoryStore } from './episodic-memory-store.ts'
import { applyRecallResult, recallAdvanceAnnouncement } from './recall-star.ts'

function response(overrides: Partial<RecallResponse>): RecallResponse {
  return {
    reconsolidated: false,
    currentText: 'unchanged',
    seed: 7n,
    recallCount: 1,
    effectiveStrength: 0.5,
    previousUniverseTime: '',
    universeTime: '2026-07-02',
    ...overrides,
  } as RecallResponse
}

const memory = {
  id: 'm1',
  name: 'Market run',
  emotion: createEmotion('CALM'),
  baseStrength: 0.5,
  recallCount: 0,
  createdUniverseTime: '2026-06-20',
  lastRecalledUniverseTime: null,
  seed: 7n,
  activations: [],
  decayStages: [],
  forgettingOffsetDays: 0,
  currentText: 'Market run text',
  semanticStage: 0,
} as EpisodicMemory

describe('applyRecallResult', () => {
  beforeEach(() => {
    useEpisodicMemoryStore.getState().setAll([memory])
  })

  it('reconsolidation folds the new seed + recall anchors into the store (the star reshapes) [A6]', () => {
    applyRecallResult(
      'm1',
      response({ reconsolidated: true, seed: 99n, recallCount: 1, universeTime: '2026-07-02' }),
    )
    const updated = useEpisodicMemoryStore.getState().byId.m1
    expect(updated?.seed).toBe(99n)
    expect(updated?.recallCount).toBe(1)
    expect(updated?.lastRecalledUniverseTime).toBe('2026-07-02')
  })

  it('reinforce-only leaves the seed (shape) unchanged, only bumps the recall anchors [A7]', () => {
    applyRecallResult('m1', response({ reconsolidated: false, seed: 7n, recallCount: 1 }))
    const updated = useEpisodicMemoryStore.getState().byId.m1
    expect(updated?.seed).toBe(7n)
    expect(updated?.recallCount).toBe(1)
  })

  it('applies nothing for an unknown memory', () => {
    applyRecallResult('ghost', response({ seed: 1n }))
    expect(useEpisodicMemoryStore.getState().byId.m1?.seed).toBe(7n)
  })
})

describe('recallAdvanceAnnouncement', () => {
  it('announces the committed sync interval when the clock advanced [A2]', () => {
    const announcement = recallAdvanceAnnouncement(
      response({ previousUniverseTime: '2026-06-20', universeTime: '2026-07-02' }),
    )
    expect(announcement).toEqual({
      interval: { previous: '2026-06-20', current: '2026-07-02' },
      revealNeuronIds: [],
    })
  })

  it('is null for a same-day sync (no interval to play)', () => {
    expect(
      recallAdvanceAnnouncement(
        response({ previousUniverseTime: '2026-07-02', universeTime: '2026-07-02' }),
      ),
    ).toBeNull()
  })

  it('is null for an unborn clock (empty previous)', () => {
    expect(
      recallAdvanceAnnouncement(response({ previousUniverseTime: '', universeTime: '2026-07-02' })),
    ).toBeNull()
  })
})
