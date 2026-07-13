import { VALUES } from '@cosimosi/config'
import { createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { describe, expect, it } from 'vitest'

import { buildContributors } from './contributors.ts'

const { nebula } = VALUES

function memory(overrides: Partial<EpisodicMemory> = {}): EpisodicMemory {
  return {
    id: 'm',
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

describe('buildContributors', () => {
  it('maps bleed radius from EffectiveStrength with the generated coefficient [A3]', () => {
    const { radii } = buildContributors([memory({ baseStrength: 0.5 })], { firstNodeIndex: 0 })
    expect(radii[0]).toBeCloseTo(
      Math.max(nebula.minBleedRadius, nebula.bleedRadiusCoefficient * 0.5),
    )
  })

  it('floors the weakest star at min_bleed_radius [A3]', () => {
    const { radii } = buildContributors([memory({ baseStrength: 0 })], { firstNodeIndex: 0 })
    expect(radii[0]).toBe(nebula.minBleedRadius)
  })

  it('weighs by EffectiveStrength (base + recall), the Epic-C mirror seam [A8]', () => {
    // contributors reads the derived effectiveStrength(base, recall), not raw base, so once the
    // recall term is live ([R3][V3]) a recalled memory bleeds wider — recall grows strength, and
    // reading the derived value (not raw base) is what carries that through to the nebula radius.
    const fresh = buildContributors([memory({ baseStrength: 0.5, recallCount: 0 })], {
      firstNodeIndex: 0,
    })
    const reread = buildContributors([memory({ baseStrength: 0.5, recallCount: 9 })], {
      firstNodeIndex: 0,
    })
    expect(reread.radii[0]).toBeGreaterThan(fresh.radii[0] ?? 0)
  })

  it('keeps store→buffer index alignment: nodeIndex = firstNodeIndex + storeIndex', () => {
    const memories = [memory({ baseStrength: 0.6 }), memory({ baseStrength: 0.6 })]
    const { count, nodeIndices } = buildContributors(memories, { firstNodeIndex: 5 })
    expect(count).toBe(2)
    expect([...nodeIndices].sort((a, b) => a - b)).toEqual([5, 6])
  })

  it('skips a missing memory without shifting the buffer index', () => {
    const { count, nodeIndices } = buildContributors([undefined, memory({ baseStrength: 0.6 })], {
      firstNodeIndex: 0,
    })
    expect(count).toBe(1)
    expect(nodeIndices[0]).toBe(1)
  })

  it('honors the contributor cap, keeping the strongest [A3 budget]', () => {
    const cap = nebula.maxContributors
    const memories = Array.from({ length: cap + 2 }, (_, i) =>
      memory({ baseStrength: i === 0 ? 0.95 : i === 1 ? 0.9 : 0.4 }),
    )
    const { count, nodeIndices } = buildContributors(memories, { firstNodeIndex: 0 })
    expect(count).toBe(cap)
    expect([...nodeIndices]).toContain(0)
    expect([...nodeIndices]).toContain(1)
  })

  it('draws color solely through the palette seam — mood decides the tint [A4]', () => {
    const sad = buildContributors([memory({ emotion: createEmotion('SAD') })], {
      firstNodeIndex: 0,
    }).tints
    const joy = buildContributors([memory({ emotion: createEmotion('JOY') })], {
      firstNodeIndex: 0,
    }).tints
    expect([sad[0], sad[1], sad[2]]).not.toEqual([joy[0], joy[1], joy[2]])
  })
})
