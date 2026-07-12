import { createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { describe, expect, it } from 'vitest'

import { currentDecayStage, currentDecayText } from './current-decay-text.ts'

function memory(overrides: Partial<EpisodicMemory> = {}): EpisodicMemory {
  return {
    id: 'm',
    name: 'a memory',
    emotion: createEmotion('CALM'),
    baseStrength: 0.5,
    recallCount: 0,
    createdUniverseTime: '2026-01-01',
    lastRecalledUniverseTime: null,
    seed: null,
    activations: [],
    decayStages: [],
    forgettingOffsetDays: 0,
    currentText: 'the whole memory as first written',
    ...overrides,
  }
}

describe('currentDecayStage', () => {
  it('is 0 for a freshly-created star and deepens as universe-time passes', () => {
    expect(currentDecayStage(memory(), '2026-01-01')).toBe(0)
    expect(currentDecayStage(memory(), '2027-06-01')).toBeGreaterThan(
      currentDecayStage(memory(), '2026-03-01'),
    )
  })

  it('returns 0 when the last recall is the current time (recovery)', () => {
    expect(
      currentDecayStage(memory({ lastRecalledUniverseTime: '2027-01-01' }), '2027-01-01'),
    ).toBe(0)
  })
})

describe('currentDecayText', () => {
  it('returns the whole current text while vivid (stage 0)', () => {
    expect(currentDecayText(memory(), '2026-01-01')).toBe('the whole memory as first written')
  })

  it('returns the persisted decay-stage string once decayed', () => {
    const decayed = memory({
      decayStages: ['stage one xxxx', 'stage two xxxx', 'stage three xxxx', 'stage four xxxx'],
    })
    const stage = currentDecayStage(decayed, '2027-06-01')
    expect(stage).toBeGreaterThan(0)
    expect(currentDecayText(decayed, '2027-06-01')).toBe(decayed.decayStages[stage - 1])
  })

  it('falls back to the whole current text when the stage string is not yet persisted', () => {
    // Decayed (stage > 0) but decayStages empty — the advance-time hook has not filled them yet.
    const decayed = memory()
    expect(currentDecayStage(decayed, '2027-06-01')).toBeGreaterThan(0)
    expect(currentDecayText(decayed, '2027-06-01')).toBe('the whole memory as first written')
  })

  it('recovers the whole text on recall (last recall = now)', () => {
    const decayed = memory({
      lastRecalledUniverseTime: '2027-06-01',
      decayStages: ['stage one xxxx', 'stage two xxxx', 'stage three xxxx', 'stage four xxxx'],
    })
    expect(currentDecayText(decayed, '2027-06-01')).toBe('the whole memory as first written')
  })
})
