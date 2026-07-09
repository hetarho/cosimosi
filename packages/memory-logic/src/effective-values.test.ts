import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

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

const fixtureUrl = new URL(
  '../../../apps/api/internal/memory/testdata/synapse-plasticity-golden.json',
  import.meta.url,
)

describe('memory effective values', () => {
  it('accumulates recall with diminishing returns toward the cap, identity at count 0', () => {
    // Launched, never-recalled stars keep their base strength ([A5]).
    expect(effectiveStrength(0.42, 0)).toBe(0.42)
    expect(effectiveStrength(0.42, 1)).toBeGreaterThan(0.42)

    // Consecutive counts so each increment is exactly one recall (diminishing per-recall).
    let previous = 0.42
    let previousIncrement = Number.POSITIVE_INFINITY
    for (let count = 1; count <= 40; count += 1) {
      const got = effectiveStrength(0.42, count)
      expect(got).toBeGreaterThanOrEqual(previous - 1e-12)
      expect(got).toBeLessThanOrEqual(VALUES.synapse.strengthCap)
      const increment = got - previous
      expect(increment).toBeLessThanOrEqual(previousIncrement + 1e-12)
      previousIncrement = increment
      previous = got
    }
  })

  it('keeps EffectiveBrightness the Epic-D stub (full brightness)', () => {
    expect(effectiveBrightness(180)).toBe(1)
  })

  it('matches the shared Go golden fixture', () => {
    const fixture = readFixture()

    for (const testCase of fixture.cases) {
      let got: number | undefined
      if (testCase.function === 'effective_strength') {
        got = effectiveStrength(
          required(testCase.inputs.base_strength),
          required(testCase.inputs.recall_count),
        )
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
