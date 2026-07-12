import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { effectiveBrightness } from './effective-values.ts'
import { decayStage, decayStageText, effectiveElapsedDays } from './forgetting.ts'

interface ForgettingFixture {
  readonly tolerance: number
  readonly values: {
    readonly brightness_decay_per_day: number
    readonly brightness_floor: number
    readonly stage_interval_days: number
    readonly stage_word_removal_ratios: readonly number[]
    readonly arousal_slow_coefficient: number
    readonly connection_slow_coefficient: number
  }
  readonly cases: readonly {
    readonly function: string
    readonly inputs: {
      readonly now?: string
      readonly last_recalled?: string
      readonly created?: string
      readonly offset_days?: number
      readonly effective_elapsed_days?: number
      readonly arousal?: number
      readonly effective_strength?: number
      readonly current_text?: string
      readonly stage?: number
      readonly seed?: string
    }
    readonly expected?: number
    readonly expected_text?: string
  }[]
}

const fixtureUrl = new URL(
  '../../../apps/api/internal/memory/testdata/forgetting-decay-golden.json',
  import.meta.url,
)

const MAX_STAGE = VALUES.forgetting.stageWordRemovalRatios.length

describe('forgetting decay', () => {
  it('keeps the generated constants aligned with the golden fixture', () => {
    const fixture = readFixture()
    expect(fixture.values).toEqual({
      brightness_decay_per_day: VALUES.forgetting.brightnessDecayPerDay,
      brightness_floor: VALUES.forgetting.brightnessFloor,
      stage_interval_days: VALUES.forgetting.stageIntervalDays,
      stage_word_removal_ratios: [...VALUES.forgetting.stageWordRemovalRatios],
      arousal_slow_coefficient: VALUES.forgetting.arousalSlowCoefficient,
      connection_slow_coefficient: VALUES.forgetting.connectionSlowCoefficient,
    })
  })

  it('matches the shared Go golden fixture byte/tolerance-for-tolerance', () => {
    const fixture = readFixture()
    for (const testCase of fixture.cases) {
      const { inputs } = testCase
      if (testCase.function === 'effective_elapsed_days') {
        const got = effectiveElapsedDays(
          required(inputs.now),
          inputs.last_recalled ?? null,
          required(inputs.created),
          required(inputs.offset_days),
        )
        expect(Math.abs(got - required(testCase.expected))).toBeLessThanOrEqual(fixture.tolerance)
      } else if (testCase.function === 'effective_brightness') {
        const got = effectiveBrightness(
          required(inputs.effective_elapsed_days),
          required(inputs.arousal),
          required(inputs.effective_strength),
        )
        expect(Math.abs(got - required(testCase.expected))).toBeLessThanOrEqual(fixture.tolerance)
      } else if (testCase.function === 'decay_stage') {
        const got = decayStage(
          required(inputs.effective_elapsed_days),
          required(inputs.arousal),
          required(inputs.effective_strength),
        )
        expect(got).toBe(required(testCase.expected))
      } else if (testCase.function === 'decay_stage_text') {
        const got = decayStageText(
          required(inputs.current_text),
          required(inputs.stage),
          BigInt(required(inputs.seed)),
        )
        expect(got).toBe(required(testCase.expected_text))
      }
    }
  })

  it('anchors elapsed on last recall or creation, signed offset floored at 0', () => {
    expect(effectiveElapsedDays('2026-03-01', null, '2026-01-01', 0)).toBe(59)
    expect(effectiveElapsedDays('2026-03-01', '2026-02-01', '2026-01-01', 0)).toBe(28)
    expect(effectiveElapsedDays('2026-03-01', '2026-02-01', '2026-01-01', 5)).toBe(33)
    expect(effectiveElapsedDays('2026-03-01', '2026-02-01', '2026-01-01', -1000)).toBe(0)
    expect(effectiveElapsedDays('2026-03-01', '2027-01-01', '2026-01-01', 0)).toBe(0)
  })

  it('EffectiveBrightness is 1.0 at 0, monotone, floored, slowed by arousal/strength', () => {
    const floor = VALUES.forgetting.brightnessFloor
    expect(effectiveBrightness(0, 0, 0)).toBe(1)

    let previous = Number.POSITIVE_INFINITY
    for (const days of [0, 1, 7, 30, 90, 180, 365, 3650]) {
      const got = effectiveBrightness(days, 0.5, 0.5)
      expect(got).toBeLessThanOrEqual(previous + 1e-12)
      expect(got).toBeGreaterThanOrEqual(floor - 1e-12)
      expect(got).toBeLessThanOrEqual(1 + 1e-12)
      expect(got).toBeGreaterThan(0)
      previous = got
    }

    for (const days of [30, 180, 3650]) {
      expect(effectiveBrightness(days, 0.9, 0.5)).toBeGreaterThanOrEqual(
        effectiveBrightness(days, 0.1, 0.5) - 1e-12,
      )
      expect(effectiveBrightness(days, 0.5, 0.9)).toBeGreaterThanOrEqual(
        effectiveBrightness(days, 0.5, 0.1) - 1e-12,
      )
    }
  })

  it('DecayStage is 0 at 0, monotone non-decreasing, floored at maxStage', () => {
    expect(decayStage(0, 0, 0)).toBe(0)
    let previous = 0
    for (const days of [0, 10, 30, 45, 60, 90, 120, 150, 100000]) {
      const got = decayStage(days, 0, 0)
      expect(got).toBeGreaterThanOrEqual(previous)
      expect(got).toBeGreaterThanOrEqual(0)
      expect(got).toBeLessThanOrEqual(MAX_STAGE)
      previous = got
    }
    expect(decayStage(1e9, 0, 0)).toBe(MAX_STAGE)
    expect(decayStage(90, 1, 1)).toBeLessThanOrEqual(decayStage(90, 0, 0))
  })

  it('decayStageText is deterministic, nested-superset, structure-preserving, never empty', () => {
    const seed = 1234567
    const texts = [
      'I went to the market today and bought fresh pasta with my friend.',
      '나는 오늘 친구랑 파스타랑 커피를 정말 맛있게 먹었다 그리고 행복했다',
      'First sentence here. Second sentence follows. Third one ends it all.',
    ]
    for (const text of texts) {
      expect(decayStageText(text, 2, seed)).toBe(decayStageText(text, 2, seed))
      expect(decayStageText(text, 0, seed)).toBe(text.trim().split(/\s+/).join(' '))

      const original = text.trim().split(/\s+/)
      let previousRemoved = new Set<number>()
      for (let stage = 1; stage <= MAX_STAGE; stage += 1) {
        const words = decayStageText(text, stage, seed).split(/\s+/)
        expect(words.length).toBeGreaterThan(0)
        expect(words[0]).toBe(original[0])
        expect(words.at(-1)).toBe(original.at(-1))
        const removed = new Set<number>()
        words.forEach((word, index) => {
          if (word === 'xxxx' && original[index] !== 'xxxx') removed.add(index)
        })
        for (const index of previousRemoved) expect(removed.has(index)).toBe(true)
        expect(removed.size).toBeGreaterThanOrEqual(previousRemoved.size)
        previousRemoved = removed
      }
    }

    for (const text of ['안녕', '짧은 문장', 'one two']) {
      for (let stage = 0; stage <= MAX_STAGE; stage += 1) {
        expect(decayStageText(text, stage, seed).trim()).not.toBe('')
      }
    }
  })
})

function readFixture(): ForgettingFixture {
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as ForgettingFixture
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('golden fixture is missing a required input')
  return value
}
