import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'
import { createEmotion } from '@cosimosi/emotion'
import { SEMANTIC_MAX_STAGE, effectiveStrength, gistCoordinate } from '@cosimosi/memory-logic'

import type { EpisodicMemory } from '@cosimosi/memory'

import { gistNodeId, gistStarInstances, parseGistNodeId } from './gist-star-channels.ts'
import { hexToLinearRgb } from './star-channels.ts'
import { moodColor } from '@cosimosi/emotion'

function memory(overrides: Partial<EpisodicMemory> = {}): EpisodicMemory {
  return {
    id: 'memory-1',
    name: 'a memory',
    emotion: createEmotion('JOY'),
    baseStrength: 0.5,
    recallCount: 0,
    createdUniverseTime: '2026-01-01',
    lastRecalledUniverseTime: null,
    seed: 42n,
    activations: [],
    decayStages: [],
    forgettingOffsetDays: 0,
    currentText: 'a memory',
    semanticStage: 0,
    ...overrides,
  }
}

const { rendering, forceSim } = VALUES

describe('gistStarInstances', () => {
  // The trace TRANSFORMS: one body per risen memory, at its current rung. The as-is emitted a
  // stack of 1, 2, 3, 4 bodies at these stages, which is the regression this pins.
  it('emits exactly one instance per risen memory, whatever the stage [C6][C7]', () => {
    for (let stage = 1; stage <= SEMANTIC_MAX_STAGE; stage++) {
      const instances = gistStarInstances([memory({ semanticStage: stage })])
      expect(instances).toHaveLength(1)
      expect(instances[0]!.stage).toBe(stage)
      expect(instances[0]!.nodeId).toBe(gistNodeId('memory-1'))
    }
  })

  it('counts one body per risen memory across a mixed universe', () => {
    const instances = gistStarInstances([
      memory({ id: 'a', semanticStage: 0 }),
      memory({ id: 'b', semanticStage: 1 }),
      memory({ id: 'c', semanticStage: 4 }),
      memory({ id: 'd', semanticStage: 2 }),
    ])
    expect(instances.map((instance) => instance.memoryId)).toEqual(['b', 'c', 'd'])
  })

  it('emits nothing for an unrisen memory and clamps past the ladder ceiling', () => {
    expect(gistStarInstances([memory({ semanticStage: 0 })])).toEqual([])
    const clamped = gistStarInstances([memory({ semanticStage: 99 })])
    expect(clamped).toHaveLength(1)
    expect(clamped[0]!.stage).toBe(SEMANTIC_MAX_STAGE)
    // A corrupt stage floors to no body rather than NaN instances.
    expect(gistStarInstances([memory({ semanticStage: Number.NaN })])).toEqual([])
  })

  it('takes z from the golden-parity gistCoordinate inside the neocortex band [I5][V9]', () => {
    for (let stage = 1; stage <= SEMANTIC_MAX_STAGE; stage++) {
      const [instance] = gistStarInstances([memory({ semanticStage: stage })])
      expect(instance!.z).toBe(gistCoordinate(0, 0, stage).z)
      expect(instance!.z).toBeGreaterThanOrEqual(forceSim.neocortexZMin)
      expect(instance!.z).toBeLessThanOrEqual(forceSim.neocortexZMax)
    }
  })

  it('rises: a deeper stage puts the one body higher [A2]', () => {
    const zByStage = Array.from(
      { length: SEMANTIC_MAX_STAGE },
      (_, i) => gistStarInstances([memory({ semanticStage: i + 1 })])[0]!.z,
    )
    for (let i = 1; i < zByStage.length; i++) {
      expect(zByStage[i]!).toBeGreaterThan(zByStage[i - 1]!)
    }
  })

  it('colors by the emotion palette seam only and sizes by EffectiveStrength [M3][I3][V3]', () => {
    const source = memory({ semanticStage: 2, recallCount: 3 })
    const [first] = gistStarInstances([source])
    expect(first.color).toEqual(hexToLinearRgb(moodColor(source.emotion.mood)))
    const strength = effectiveStrength(source.baseStrength, source.recallCount)
    const expectedSize =
      rendering.gistStarSizeMin + (rendering.gistStarSizeMax - rendering.gistStarSizeMin) * strength
    expect(first.size).toBeCloseTo(expectedSize, 12)
    // The gist range sits below the episodic star range — a quieter echo.
    expect(rendering.gistStarSizeMax).toBeLessThan(rendering.starSizeMax)
  })

  it('reads progressively more diffuse with stage, from the base softness [V5]', () => {
    // Softness now reads the memory's CURRENT stage, so the ladder is walked across memories
    // rather than down one memory's stack.
    const softnessByStage = Array.from(
      { length: SEMANTIC_MAX_STAGE },
      (_, i) => gistStarInstances([memory({ semanticStage: i + 1 })])[0]!.softness,
    )
    expect(softnessByStage[0]!).toBeCloseTo(rendering.gistStarDiffuse, 12)
    expect(softnessByStage[softnessByStage.length - 1]!).toBeCloseTo(1, 12)
    for (let i = 1; i < softnessByStage.length; i++) {
      expect(softnessByStage[i]!).toBeGreaterThan(softnessByStage[i - 1]!)
    }
  })
})

describe('gistNodeId / parseGistNodeId', () => {
  it('round-trips, memory ids with colons included', () => {
    const id = gistNodeId('mem:with:colons')
    expect(parseGistNodeId(id)).toEqual({ episodicMemoryId: 'mem:with:colons' })
  })

  it('is stable across a rise — the id names the memory, never the depth', () => {
    const first = gistStarInstances([memory({ semanticStage: 1 })])[0]!
    const risen = gistStarInstances([memory({ semanticStage: 4 })])[0]!
    expect(risen.nodeId).toBe(first.nodeId)
  })

  it('recognizes nothing else — episodic/neuron ids and malformed gist ids resolve null', () => {
    expect(parseGistNodeId('memory-1')).toBeNull()
    expect(parseGistNodeId('gist:')).toBeNull()
  })
})
