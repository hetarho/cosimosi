import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import {
  SEMANTIC_MAX_STAGE,
  gistCoordinate,
  gistUnitsElapsed,
  semanticize,
} from './semanticization.ts'

interface SemanticFixture {
  readonly tolerance: number
  readonly values: {
    readonly gist_units_per_stage: number
    readonly neocortex_z_min: number
    readonly neocortex_z_max: number
    readonly max_stage: number
  }
  readonly cases: readonly {
    readonly function: string
    readonly inputs: {
      readonly current_stage?: number
      readonly units_elapsed?: number
      readonly now?: string
      readonly timer_reset_at?: string
      readonly arousal?: number
      readonly connection_strength?: number
      readonly hippocampal_x?: number
      readonly hippocampal_y?: number
      readonly stage?: number
    }
    readonly expected?: number
    readonly expected_coord?: { readonly x: number; readonly y: number; readonly z: number }
  }[]
}

const fixtureUrl = new URL(
  '../../../apps/api/internal/memory/testdata/semanticization-golden.json',
  import.meta.url,
)

describe('semanticization', () => {
  it('keeps the generated constants aligned with the golden fixture', () => {
    const fixture = readFixture()
    expect(fixture.values).toEqual({
      gist_units_per_stage: VALUES.semantic.gistUnitsPerStage,
      neocortex_z_min: VALUES.forceSim.neocortexZMin,
      neocortex_z_max: VALUES.forceSim.neocortexZMax,
      max_stage: SEMANTIC_MAX_STAGE,
    })
  })

  it('matches the shared Go golden fixture', () => {
    const fixture = readFixture()
    for (const testCase of fixture.cases) {
      const { inputs } = testCase
      if (testCase.function === 'semanticize') {
        const got = semanticize(required(inputs.current_stage), required(inputs.units_elapsed))
        expect(got).toBe(required(testCase.expected))
      } else if (testCase.function === 'gist_units_elapsed') {
        const got = gistUnitsElapsed(
          required(inputs.now),
          required(inputs.timer_reset_at),
          required(inputs.arousal),
          required(inputs.connection_strength),
        )
        expect(got).toBe(required(testCase.expected))
      } else if (testCase.function === 'gist_coordinate') {
        const got = gistCoordinate(
          required(inputs.hippocampal_x),
          required(inputs.hippocampal_y),
          required(inputs.stage),
        )
        const want = required(testCase.expected_coord)
        expect(Math.abs(got.x - want.x)).toBeLessThanOrEqual(fixture.tolerance)
        expect(Math.abs(got.y - want.y)).toBeLessThanOrEqual(fixture.tolerance)
        expect(Math.abs(got.z - want.z)).toBeLessThanOrEqual(fixture.tolerance)
      }
    }
  })

  it('semanticize is monotone, clamped, crosses multiple stages, never lowers', () => {
    for (let stage = 0; stage <= SEMANTIC_MAX_STAGE; stage += 1) {
      expect(semanticize(stage, 0)).toBe(stage)
      let previous = stage
      for (const units of [0, 1, 2, 5, 100]) {
        const got = semanticize(stage, units)
        expect(got).toBeGreaterThanOrEqual(previous)
        expect(got).toBeGreaterThanOrEqual(stage)
        expect(got).toBeLessThanOrEqual(SEMANTIC_MAX_STAGE)
        previous = got
      }
    }
    expect(semanticize(1, 2)).toBe(3)
    expect(semanticize(3, 10)).toBe(SEMANTIC_MAX_STAGE)
  })

  it('gist-timer is 0 at the anchor, whole universe-days, slowed by arousal/strength', () => {
    expect(gistUnitsElapsed('2026-01-01', '2026-01-01', 0, 0)).toBe(0)
    expect(gistUnitsElapsed('2026-01-26', '2026-01-01', 0, 0)).toBe(2)
    // Higher arousal/strength slows it → fewer (or equal) units at the same elapsed.
    expect(gistUnitsElapsed('2026-01-26', '2026-01-01', 1, 1)).toBeLessThanOrEqual(2)
    // A future reset (now before anchor) never goes negative.
    expect(gistUnitsElapsed('2026-01-01', '2027-01-01', 0, 0)).toBe(0)
  })

  it('gist coordinate copies x,y and keeps z inside the neocortex band, disjoint from hippocampus', () => {
    for (let stage = 1; stage <= SEMANTIC_MAX_STAGE; stage += 1) {
      const { x, y, z } = gistCoordinate(3.5, -7.25, stage)
      expect(x).toBe(3.5)
      expect(y).toBe(-7.25)
      expect(z).toBeGreaterThanOrEqual(VALUES.forceSim.neocortexZMin)
      expect(z).toBeLessThanOrEqual(VALUES.forceSim.neocortexZMax)
      expect(z).toBeGreaterThan(VALUES.forceSim.hippocampusZMax)
    }
    expect(gistCoordinate(0, 0, SEMANTIC_MAX_STAGE).z).toBeGreaterThan(gistCoordinate(0, 0, 1).z)
  })
})

function readFixture(): SemanticFixture {
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as SemanticFixture
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('golden fixture is missing a required input')
  return value
}
