import { VALUES } from '@cosimosi/config'
import { createEmotion, type Mood } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { describe, expect, it } from 'vitest'

import { hexToLinearRgb, normalizeSeed, starChannels } from './star-channels.ts'

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
    ...overrides,
  }
}

const { rendering } = VALUES

describe('starChannels', () => {
  it('is deterministic — same facts draw the same star', () => {
    expect(starChannels(memory(), '2026-02-01')).toEqual(starChannels(memory(), '2026-02-01'))
  })

  it('maps size within the generated range and grows with strength [V3]', () => {
    const small = starChannels(memory({ baseStrength: 0.1 }), null).size
    const large = starChannels(memory({ baseStrength: 0.9 }), null).size
    expect(small).toBeGreaterThanOrEqual(rendering.starSizeMin)
    expect(large).toBeLessThanOrEqual(rendering.starSizeMax)
    expect(large).toBeGreaterThan(small)
  })

  it('renders full brightness in Epic A, inside the range [V2]', () => {
    const { brightness } = starChannels(memory(), '2026-06-01')
    expect(brightness).toBeGreaterThanOrEqual(rendering.starBrightnessMin)
    expect(brightness).toBeLessThanOrEqual(rendering.starBrightnessMax)
    expect(brightness).toBe(rendering.starBrightnessMax)
  })

  it('binds color to emotion only — same mood same color, different mood different color [I3][M3]', () => {
    const moods: readonly Mood[] = ['JOY', 'SAD']
    const colors = moods.map(
      (mood) => starChannels(memory({ emotion: createEmotion(mood) }), null).color,
    )
    // A second JOY memory with different strength/seed still gets the same color.
    expect(
      starChannels(memory({ emotion: createEmotion('JOY'), baseStrength: 0.9, seed: 9n }), null)
        .color,
    ).toEqual(colors[0])
    expect(colors[0]).not.toEqual(colors[1])
  })

  it('gives different seeds different form parameters [V5]', () => {
    expect(starChannels(memory({ seed: 1n }), null).seed).not.toBe(
      starChannels(memory({ seed: 2n }), null).seed,
    )
  })
})

describe('normalizeSeed', () => {
  it('is a stable 0..1 value and never mutates its input [A7]', () => {
    expect(normalizeSeed(42n, 'memory-1')).toBe(normalizeSeed(42n, 'memory-1'))
    const value = normalizeSeed(7n, 'x')
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })

  it('falls back to a stable id hash when the seed is absent', () => {
    expect(normalizeSeed(null, 'memory-1')).toBe(normalizeSeed(null, 'memory-1'))
    expect(normalizeSeed(null, 'a')).not.toBe(normalizeSeed(null, 'b'))
  })
})

describe('hexToLinearRgb', () => {
  it('parses hex to linear rgb in 0..1 (black and white anchors)', () => {
    expect(hexToLinearRgb('#000000')).toEqual([0, 0, 0])
    expect(hexToLinearRgb('#ffffff')).toEqual([1, 1, 1])
  })
})
