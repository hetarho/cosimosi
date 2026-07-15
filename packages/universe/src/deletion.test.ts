import { beforeEach, describe, expect, it } from 'vitest'

import type { EpisodicMemory } from '@cosimosi/memory'

import { applyReleaseResult, applyRestoreResult } from './deletion.ts'
import { useEpisodicMemoryStore } from './episodic-memory-store.ts'
import { useReleasedGroupsStore } from './released-groups-store.ts'

const memory = (id: string): EpisodicMemory => ({
  id,
  name: id,
  emotion: { mood: 'JOY', valence: 0.5, arousal: 0.5, intensity: 0.5 },
  baseStrength: 0.5,
  recallCount: 0,
  createdUniverseTime: '2026-07-01',
  lastRecalledUniverseTime: null,
  seed: null,
  activations: [],
  decayStages: [],
  forgettingOffsetDays: 0,
  currentText: id,
  semanticStage: 0,
})

beforeEach(() => {
  useEpisodicMemoryStore.getState().setAll([])
  useReleasedGroupsStore.getState().reset()
})

describe('applyReleaseResult', () => {
  const response = {
    $typeName: 'cosimosi.memory.v1.ReleaseResponse' as const,
    diaryId: 'd1',
    episodicMemoryIds: ['m1', 'm2'],
    deletedAt: '2026-07-15T00:00:00Z',
  }

  it('removes exactly the returned ids and records the group with the snapshots', () => {
    useEpisodicMemoryStore.getState().setAll([memory('m1'), memory('m2'), memory('m3')])
    applyReleaseResult(response)
    expect(useEpisodicMemoryStore.getState().ids).toEqual(['m3'])
    const [group] = useReleasedGroupsStore.getState().groups
    expect(group.diaryId).toBe('d1')
    expect(group.deletedAt).toBe('2026-07-15T00:00:00Z')
    expect(group.removedMemories.map((m) => m.id)).toEqual(['m1', 'm2'])
  })
})

describe('applyRestoreResult', () => {
  it('re-inserts the captured snapshots and drops the group', () => {
    useEpisodicMemoryStore.getState().setAll([memory('m3')])
    useReleasedGroupsStore.getState().record({
      diaryId: 'd1',
      deletedAt: '2026-07-15T00:00:00Z',
      episodicMemoryIds: ['m1', 'm2'],
      removedMemories: [memory('m1'), memory('m2')],
    })
    applyRestoreResult('d1')
    expect([...useEpisodicMemoryStore.getState().ids].sort()).toEqual(['m1', 'm2', 'm3'])
    expect(useReleasedGroupsStore.getState().groups).toHaveLength(0)
  })

  it('does not duplicate a memory a GetUniverse already re-carried', () => {
    useEpisodicMemoryStore.getState().setAll([memory('m1')])
    useReleasedGroupsStore.getState().record({
      diaryId: 'd1',
      deletedAt: '2026-07-15T00:00:00Z',
      episodicMemoryIds: ['m1'],
      removedMemories: [memory('m1')],
    })
    applyRestoreResult('d1')
    expect(useEpisodicMemoryStore.getState().ids).toEqual(['m1'])
  })
})
