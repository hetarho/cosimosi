import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { effectiveBrightness, effectiveStrength } from './effective-values.ts'

interface EffectiveFixture {
  readonly tolerance: number
  readonly cases: readonly {
    readonly function: string
    readonly inputs: {
      readonly base_strength?: number
      readonly recall_count?: number
      readonly elapsed_universe_days?: number
    }
    readonly expected: number
  }[]
}

const fixtureUrl = new URL('../../../apps/api/internal/memory/testdata/synapse-plasticity-golden.json', import.meta.url)

describe('memory effective values', () => {
  it('keeps Epic A EffectiveStrength and EffectiveBrightness stubs distinct from synapse strength', () => {
    expect(effectiveStrength(0.42, 0)).toBe(0.42)
    expect(effectiveStrength(0.42, 12)).toBe(0.42)
    expect(effectiveBrightness(180)).toBe(1)
  })

  it('matches the shared Go golden fixture', () => {
    const fixture = readFixture()

    for (const testCase of fixture.cases) {
      let got: number | undefined
      if (testCase.function === 'effective_strength') {
        got = effectiveStrength(required(testCase.inputs.base_strength), required(testCase.inputs.recall_count))
      }
      if (testCase.function === 'effective_brightness') {
        got = effectiveBrightness(required(testCase.inputs.elapsed_universe_days))
      }
      if (got === undefined) continue
      expect(Math.abs(got - testCase.expected)).toBeLessThanOrEqual(fixture.tolerance)
    }
  })
})

function readFixture(): EffectiveFixture {
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as EffectiveFixture
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('golden fixture is missing a required input')
  return value
}
