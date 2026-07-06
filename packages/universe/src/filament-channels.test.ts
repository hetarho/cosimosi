import { VALUES } from '@cosimosi/config'
import type { Synapse } from '@cosimosi/memory'
import { describe, expect, it } from 'vitest'

import { filamentChannels, projectFilaments } from './filament-channels.ts'

function synapse(overrides: Partial<Synapse> = {}): Synapse {
  return {
    id: 'synapse-1',
    neuronAId: 'neuron-a',
    neuronBId: 'neuron-b',
    strength: 0.5,
    coActivationCount: 1,
    lastActivatedUniverseTime: '2026-01-01',
    ...overrides,
  }
}

const { rendering } = VALUES

describe('filamentChannels', () => {
  it('maps width and brightness within range and both grow with strength [V6]', () => {
    const weak = filamentChannels(synapse({ strength: 0.1 }), '2026-01-01')
    const strong = filamentChannels(synapse({ strength: 0.9 }), '2026-01-01')
    expect(weak.width).toBeGreaterThanOrEqual(rendering.filamentWidthMin)
    expect(strong.width).toBeLessThanOrEqual(rendering.filamentWidthMax)
    expect(strong.width).toBeGreaterThan(weak.width)
    expect(strong.brightness).toBeGreaterThan(weak.brightness)
    expect(strong.brightness).toBeLessThanOrEqual(rendering.filamentBrightnessMax)
  })

  it('is deterministic and colors by strength-scaled brightness, not emotion', () => {
    expect(filamentChannels(synapse(), '2026-02-01')).toEqual(filamentChannels(synapse(), '2026-02-01'))
    const strong = filamentChannels(synapse({ strength: 0.9 }), '2026-01-01')
    const weak = filamentChannels(synapse({ strength: 0.1 }), '2026-01-01')
    expect(strong.color[2]).toBeGreaterThan(weak.color[2])
  })
})

describe('projectFilaments', () => {
  const neuronIndex = { 'neuron-a': 0, 'neuron-b': 1, 'neuron-c': 2 }

  it('resolves endpoints to neuron slots only, preserving edge order', () => {
    const batch = projectFilaments([synapse({ neuronAId: 'neuron-a', neuronBId: 'neuron-c' })], neuronIndex, null)
    expect(batch.count).toBe(1)
    expect(Array.from(batch.endpointPairs)).toEqual([0, 2])
    expect(batch.widths.length).toBe(1)
    expect(batch.colors.length).toBe(3)
  })

  it('drops a synapse whose neuron has no slot — never a star↔star line [I4][I6]', () => {
    const batch = projectFilaments([synapse({ neuronBId: 'missing' })], neuronIndex, null)
    expect(batch.count).toBe(0)
    expect(batch.endpointPairs.length).toBe(0)
  })
})
