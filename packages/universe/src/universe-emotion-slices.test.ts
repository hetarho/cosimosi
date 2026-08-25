import { createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { effectiveStrength } from '@cosimosi/memory-logic'
import { describe, expect, it } from 'vitest'

import { universeEmotionSlices } from './universe-emotion-slices.ts'

function memory(overrides: Partial<EpisodicMemory> = {}): EpisodicMemory {
  return {
    id: 'm',
    diaryId: 'd',
    name: 'memory',
    emotion: createEmotion('JOY'),
    baseStrength: 0.5,
    recallCount: 0,
    createdUniverseTime: '2026-01-01',
    lastRecalledUniverseTime: null,
    seed: null,
    activations: [],
    decayStages: [],
    forgettingOffsetDays: 0,
    currentText: 'a memory',
    semanticStage: 0,
    ...overrides,
  }
}

function shareOf(slices: ReturnType<typeof universeEmotionSlices>, mood: string): number {
  return slices.find((slice) => slice.mood === mood)?.weight ?? 0
}

describe('universeEmotionSlices', () => {
  it('weighs each memory by its EffectiveStrength, not by one vote [M4]', () => {
    const slices = universeEmotionSlices([
      memory({ id: 'a', emotion: createEmotion('JOY'), baseStrength: 0.8 }),
      memory({ id: 'b', emotion: createEmotion('SAD'), baseStrength: 0.2 }),
    ])
    const total = effectiveStrength(0.8, 0) + effectiveStrength(0.2, 0)
    expect(shareOf(slices, 'JOY')).toBeCloseTo(effectiveStrength(0.8, 0) / total)
    // A vote count would have split this sky in half; the stronger memory owns more of it.
    expect(shareOf(slices, 'JOY')).toBeGreaterThan(0.5)
  })

  // The honest definition [M5] promises on the landing page and in the demo: returning to a memory
  // is what moves the sky. Without the recall term this test's two universes are identical.
  it('grows an emotion’s share when its memory is recalled [M5][R3]', () => {
    const written = [
      memory({ id: 'a', emotion: createEmotion('JOY'), baseStrength: 0.5 }),
      memory({ id: 'b', emotion: createEmotion('SAD'), baseStrength: 0.5 }),
    ]
    const returnedTo = [
      written[0] as EpisodicMemory,
      { ...(written[1] as EpisodicMemory), recallCount: 4 },
    ]

    expect(shareOf(universeEmotionSlices(written), 'SAD')).toBeCloseTo(0.5)
    expect(shareOf(universeEmotionSlices(returnedTo), 'SAD')).toBeGreaterThan(
      shareOf(universeEmotionSlices(written), 'SAD'),
    )
  })

  it('adds the shares of memories that carry the same mood', () => {
    const slices = universeEmotionSlices([
      memory({ id: 'a', emotion: createEmotion('CALM'), baseStrength: 0.3 }),
      memory({ id: 'b', emotion: createEmotion('CALM'), baseStrength: 0.3 }),
      memory({ id: 'c', emotion: createEmotion('ANGER'), baseStrength: 0.6 }),
    ])
    expect(slices).toHaveLength(2)
    expect(shareOf(slices, 'CALM') + shareOf(slices, 'ANGER')).toBeCloseTo(1)
  })

  it('is the bare night for a universe with nothing in it', () => {
    expect(universeEmotionSlices([])).toEqual([])
  })
})
