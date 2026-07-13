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
  it('emits one instance per risen stage — risen stages persist [C6][C7]', () => {
    const instances = gistStarInstances([memory({ semanticStage: 3 })])
    expect(instances.map((instance) => instance.stage)).toEqual([1, 2, 3])
    expect(new Set(instances.map((instance) => instance.nodeId)).size).toBe(3)
  })

  it('emits nothing for an unrisen memory and clamps past the ladder ceiling', () => {
    expect(gistStarInstances([memory({ semanticStage: 0 })])).toEqual([])
    const clamped = gistStarInstances([memory({ semanticStage: 99 })])
    expect(clamped).toHaveLength(SEMANTIC_MAX_STAGE)
    // A corrupt stage floors to no body rather than NaN instances.
    expect(gistStarInstances([memory({ semanticStage: Number.NaN })])).toEqual([])
  })

  it('takes z from the golden-parity gistCoordinate inside the neocortex band [I5][V9]', () => {
    const instances = gistStarInstances([memory({ semanticStage: SEMANTIC_MAX_STAGE })])
    for (const instance of instances) {
      expect(instance.z).toBe(gistCoordinate(0, 0, instance.stage).z)
      expect(instance.z).toBeGreaterThanOrEqual(forceSim.neocortexZMin)
      expect(instance.z).toBeLessThanOrEqual(forceSim.neocortexZMax)
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
    const instances = gistStarInstances([memory({ semanticStage: SEMANTIC_MAX_STAGE })])
    expect(instances[0]!.softness).toBeCloseTo(rendering.gistStarDiffuse, 12)
    expect(instances[instances.length - 1]!.softness).toBeCloseTo(1, 12)
    for (let i = 1; i < instances.length; i++) {
      expect(instances[i]!.softness).toBeGreaterThan(instances[i - 1]!.softness)
    }
  })
})

describe('gistNodeId / parseGistNodeId', () => {
  it('round-trips, memory ids with colons included', () => {
    const id = gistNodeId('mem:with:colons', 2)
    expect(parseGistNodeId(id)).toEqual({ episodicMemoryId: 'mem:with:colons', stage: 2 })
  })

  it('recognizes nothing else — episodic/neuron ids and malformed gist ids resolve null', () => {
    expect(parseGistNodeId('memory-1')).toBeNull()
    expect(parseGistNodeId('gist:')).toBeNull()
    expect(parseGistNodeId('gist:x:memory-1')).toBeNull()
    expect(parseGistNodeId('gist:0:memory-1')).toBeNull()
    expect(parseGistNodeId(`gist:${SEMANTIC_MAX_STAGE + 1}:memory-1`)).toBeNull()
    expect(parseGistNodeId('gist:2:')).toBeNull()
  })
})
