import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { arousalToInitialStrength } from './strength.ts'

interface StrengthFixture {
  readonly bounds: {
    readonly min: number
    readonly max: number
  }
  readonly cases: readonly {
    readonly arousal: number
    readonly base_strength: number
  }[]
}

const canonicalFixtureUrl = new URL('../fixtures/arousal-strength.golden.json', import.meta.url)
const goMirrorFixtureUrl = new URL(
  '../../../apps/api/internal/memory/testdata/arousal-strength.golden.json',
  import.meta.url,
)

describe('arousal strength parity', () => {
  it('keeps the Go testdata mirror byte-identical to the canonical fixture', () => {
    expect(readFileSync(goMirrorFixtureUrl, 'utf8')).toBe(readFileSync(canonicalFixtureUrl, 'utf8'))
  })

  it('matches the golden fixture and generated bounds', () => {
    const fixture = readFixture()

    expect(fixture.bounds).toEqual({
      min: VALUES.emotion.arousalStrengthMin,
      max: VALUES.emotion.arousalStrengthMax,
    })
    for (const testCase of fixture.cases) {
      expect(arousalToInitialStrength(testCase.arousal)).toBeCloseTo(testCase.base_strength, 12)
    }
    expect(arousalToInitialStrength(-1)).toBe(VALUES.emotion.arousalStrengthMin)
    expect(arousalToInitialStrength(2)).toBe(VALUES.emotion.arousalStrengthMax)
  })
})

function readFixture(): StrengthFixture {
  return JSON.parse(readFileSync(canonicalFixtureUrl, 'utf8')) as StrengthFixture
}
