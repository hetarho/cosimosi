import { describe, expect, it } from 'vitest'

import {
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_TINT,
} from '@cosimosi/3d-renderer'
import { createEmotion } from '@cosimosi/emotion'
import { SPOTLIGHT_STAR_LIFT, starStaticChannels } from '@cosimosi/universe/scene'

import type { EpisodicMemory } from '@cosimosi/memory'

import { starLayerChannels } from './StarLayer.tsx'

function memory(id: string, lastRecalledUniverseTime: string | null): EpisodicMemory {
  return {
    id,
    diaryId: 'diary',
    name: id,
    emotion: createEmotion('JOY'),
    baseStrength: 0.5,
    recallCount: 1,
    createdUniverseTime: '2026-01-01',
    lastRecalledUniverseTime,
    seed: 7n,
    activations: [],
    decayStages: [],
    forgettingOffsetDays: 0,
    currentText: id,
    semanticStage: 0,
  }
}

function attribute(channels: ReturnType<typeof starLayerChannels>, name: string): Float32Array {
  const channel = channels.attributes?.find((candidate) => candidate.name === name)
  if (!channel) throw new Error(`missing ${name}`)
  return channel.array
}

describe('starLayerChannels', () => {
  const ids = ['a', 'b']
  const statics = starStaticChannels([memory('a', null), memory('b', '2026-01-10')])

  it('keeps every time-independent array by identity across a sweep step', () => {
    const before = starLayerChannels(statics, ids, '2026-01-15', [])
    const after = starLayerChannels(statics, ids, '2026-06-15', [])

    expect(after.scales).toBe(before.scales)
    expect(attribute(after, STAR_INSTANCE_TINT)).toBe(attribute(before, STAR_INSTANCE_TINT))
    expect(attribute(after, STAR_INSTANCE_SEED)).toBe(attribute(before, STAR_INSTANCE_SEED))
    // Only brightness moved, so it is the one array the layer uploads.
    expect(attribute(after, STAR_INSTANCE_BRIGHTNESS)).not.toBe(
      attribute(before, STAR_INSTANCE_BRIGHTNESS),
    )
    expect(attribute(after, STAR_INSTANCE_BRIGHTNESS)[0]).toBeLessThan(
      attribute(before, STAR_INSTANCE_BRIGHTNESS)[0] ?? 0,
    )
  })

  it('lifts the spotlit stars and no others', () => {
    const plain = attribute(
      starLayerChannels(statics, ids, '2026-02-01', []),
      STAR_INSTANCE_BRIGHTNESS,
    )
    const lit = attribute(
      starLayerChannels(statics, ids, '2026-02-01', ['b']),
      STAR_INSTANCE_BRIGHTNESS,
    )
    expect(lit[0]).toBe(plain[0])
    expect(lit[1]).toBeCloseTo((plain[1] ?? 0) * SPOTLIGHT_STAR_LIFT, 6)
  })
})
