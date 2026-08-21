import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import {
  SEMANTIC_MAX_STAGE,
  gistUnitsElapsed,
  gistZOffset,
  semanticize,
} from './semanticization.ts'

interface SemanticFixture {
  readonly tolerance: number
  readonly values: {
    readonly gist_units_per_stage: number
    readonly gist_z_offset_min: number
    readonly gist_z_offset_max: number
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
      readonly stage?: number
    }
    readonly expected?: number
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
      gist_z_offset_min: VALUES.forceSim.gistZOffsetMin,
      gist_z_offset_max: VALUES.forceSim.gistZOffsetMax,
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
      } else if (testCase.function === 'gist_z_offset') {
        const got = gistZOffset(required(inputs.stage))
        expect(Math.abs(got - required(testCase.expected))).toBeLessThanOrEqual(fixture.tolerance)
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

  it('gist z-offset is a clamped, stage-monotonic lift inside the offset ladder', () => {
    for (let stage = 1; stage <= SEMANTIC_MAX_STAGE; stage += 1) {
      const offset = gistZOffset(stage)
      expect(offset).toBeGreaterThanOrEqual(VALUES.forceSim.gistZOffsetMin)
      expect(offset).toBeLessThanOrEqual(VALUES.forceSim.gistZOffsetMax)
      if (stage > 1) expect(offset).toBeGreaterThan(gistZOffset(stage - 1))
    }
    expect(gistZOffset(-3)).toBe(gistZOffset(0))
    expect(gistZOffset(99)).toBe(gistZOffset(SEMANTIC_MAX_STAGE))
  })

  it('layer separation holds by construction: the lowest gist reach clears the lens top [C5][V9]', () => {
    // A gist body inherits its memory's live z (≥ hippocampusZMin) plus at least the stage-1 lift,
    // so the WORST-CASE gist floor must still sit above the hippocampus band's ceiling — otherwise
    // an episodic memory could stand above a gist body and the two-layer read collapses. This
    // guards the values.yaml numbers themselves; a retune that breaks it must move the offsets.
    expect(VALUES.forceSim.hippocampusZMin + gistZOffset(1)).toBeGreaterThan(
      VALUES.forceSim.hippocampusZMax,
    )
  })
})

function readFixture(): SemanticFixture {
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as SemanticFixture
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('golden fixture is missing a required input')
  return value
}
