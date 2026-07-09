import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { neighborForgettingDelta, reshape } from './reconsolidation.ts'

interface ReconsolidationFixture {
  readonly tolerance: number
  readonly values: {
    readonly recall_strength_gain: number
    readonly neighbor_slow_days: number
    readonly neighbor_speed_days: number
    readonly neighbor_speed_threshold: number
  }
  readonly cases: readonly {
    readonly function: string
    readonly inputs: {
      readonly current_seed?: number
      readonly new_seed?: number
      readonly shared_semantic_count?: number
    }
    readonly expected: number
  }[]
}

const fixtureUrl = new URL(
  '../../../apps/api/internal/memory/testdata/reconsolidation-golden.json',
  import.meta.url,
)

describe('reconsolidation rules', () => {
  it('keeps generated reconsolidation constants aligned with the golden fixture', () => {
    const fixture = readFixture()
    expect(fixture.values).toEqual({
      recall_strength_gain: VALUES.reconsolidation.recallStrengthGain,
      neighbor_slow_days: VALUES.reconsolidation.neighborSlowDays,
      neighbor_speed_days: VALUES.reconsolidation.neighborSpeedDays,
      neighbor_speed_threshold: VALUES.reconsolidation.neighborSpeedThreshold,
    })
  })

  it('matches the shared Go golden fixture', () => {
    const fixture = readFixture()
    for (const testCase of fixture.cases) {
      let got: number
      switch (testCase.function) {
        case 'reshape':
          got = reshape(required(testCase.inputs.current_seed), required(testCase.inputs.new_seed))
          break
        case 'neighbor_forgetting_delta':
          got = neighborForgettingDelta(required(testCase.inputs.shared_semantic_count))
          break
        default:
          throw new Error(`unknown golden function ${testCase.function}`)
      }
      expect(Math.abs(got - testCase.expected)).toBeLessThanOrEqual(fixture.tolerance)
    }
  })

  it('reshape returns a different seed, even when the supplied entropy collides ([V5])', () => {
    expect(reshape(100, 250)).toBe(250)
    for (const seed of [0, 1, -1, 42, -7, 9_000_000_000]) {
      expect(reshape(seed, seed)).not.toBe(seed)
    }
    expect(reshape(42, 42)).toBe(reshape(42, 42))
  })

  it('neighborForgettingDelta signs across the generated threshold ([R5])', () => {
    const threshold = VALUES.reconsolidation.neighborSpeedThreshold
    expect(neighborForgettingDelta(0)).toBe(0)
    expect(neighborForgettingDelta(1)).toBeLessThan(0)
    expect(neighborForgettingDelta(threshold - 1)).toBeLessThan(0)
    for (const count of [threshold, threshold + 1, threshold + 5]) {
      expect(neighborForgettingDelta(count)).toBeGreaterThan(0)
    }
    expect(neighborForgettingDelta(1)).toBe(VALUES.reconsolidation.neighborSlowDays)
    expect(neighborForgettingDelta(threshold)).toBe(VALUES.reconsolidation.neighborSpeedDays)
  })
})

function readFixture(): ReconsolidationFixture {
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as ReconsolidationFixture
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('golden fixture is missing a required input')
  return value
}
