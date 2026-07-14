import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { basicRemaining, gistViewCost, planSpend, recallCost } from './stardust-ledger.ts'

interface LedgerFixture {
  readonly tolerance: number
  readonly values: {
    readonly basic_daily_amount: number
    readonly recall_base_cost: number
    readonly recall_depth_coefficient: number
    readonly recall_max_cost: number
    readonly gist_base_cost: number
    readonly gist_stage_discount: number
    readonly gist_min_cost: number
  }
  readonly cases: readonly LedgerFixtureCase[]
}

interface LedgerFixtureCase {
  readonly function: 'recall_cost' | 'gist_view_cost' | 'plan_spend' | 'basic_remaining'
  readonly inputs: {
    readonly accessibility_cost?: number
    readonly semantic_stage?: number
    readonly basic_remaining?: number
    readonly additional?: number
    readonly cost?: number
    readonly now?: string
    readonly reset_window?: string
    readonly spent_this_window?: number
  }
  readonly expected?: number
  readonly expected_plan?: {
    readonly from_basic: number
    readonly from_additional: number
    readonly ok: boolean
  }
}

const fixtureUrl = new URL(
  '../../../apps/api/internal/twinkle/testdata/stardust-ledger-golden.json',
  import.meta.url,
)

describe('stardust ledger', () => {
  it('keeps generated twinkle constants aligned with the golden fixture', () => {
    const fixture = readFixture()

    expect(fixture.values).toEqual({
      basic_daily_amount: VALUES.twinkle.basicDailyAmount,
      recall_base_cost: VALUES.twinkle.recallBaseCost,
      recall_depth_coefficient: VALUES.twinkle.recallDepthCoefficient,
      recall_max_cost: VALUES.twinkle.recallMaxCost,
      gist_base_cost: VALUES.twinkle.gistBaseCost,
      gist_stage_discount: VALUES.twinkle.gistStageDiscount,
      gist_min_cost: VALUES.twinkle.gistMinCost,
    })
  })

  it('keeps basicRemaining daily-reset, non-carrying, and never negative', () => {
    const grant = VALUES.twinkle.basicDailyAmount

    // A fresh UTC day yields the full grant no matter the prior window's spend — no carry.
    for (const spent of [0, 1, 50, grant, grant + 30]) {
      expect(basicRemaining('2026-07-15T00:00:00Z', '2026-07-14', spent)).toBe(grant)
    }

    // Inside the window: grant − spent, floored at 0.
    expect(basicRemaining('2026-07-14T09:00:00Z', '2026-07-14', 40)).toBe(grant - 40)
    expect(basicRemaining('2026-07-14T09:00:00Z', '2026-07-14', grant)).toBe(0)
    expect(basicRemaining('2026-07-14T09:00:00Z', '2026-07-14', grant + 30)).toBe(0)

    // The boundary is the UTC day, exactly: 23:59:59 same window, midnight fresh.
    expect(basicRemaining('2026-07-14T23:59:59Z', '2026-07-14', 30)).toBe(grant - 30)
    expect(basicRemaining('2026-07-15T00:00:00Z', '2026-07-14', 30)).toBe(grant)
    // A wall-clock next-day instant still inside the same UTC day stays the same window.
    expect(basicRemaining('2026-07-15T01:00:00+09:00', '2026-07-14', 30)).toBe(grant - 30)

    // A stale/non-parseable now never over-grants (conservative same-window derivation).
    expect(basicRemaining('2026-07-13T12:00:00Z', '2026-07-14', 30)).toBe(grant - 30)
    expect(basicRemaining('not a time', '2026-07-14', 30)).toBe(grant - 30)

    // A zone-less datetime is pinned to UTC, not the viewer's local zone (Go parity): still
    // 07-14 in UTC ⇒ same window, and exactly midnight UTC of 07-15 ⇒ fresh, in every locale.
    expect(basicRemaining('2026-07-14T23:59:59', '2026-07-14', 30)).toBe(grant - 30)
    expect(basicRemaining('2026-07-15T00:00:00', '2026-07-14', 30)).toBe(grant)
  })

  it('keeps planSpend basic-first, exact, and never negative', () => {
    for (const basic of [0, 1, 10, 50, 100]) {
      for (const additional of [0, 1, 25, 500]) {
        for (const cost of [-5, 0, 1, 10, 60, 100, 151, 700]) {
          const plan = planSpend(basic, additional, cost)
          const boundedCost = Math.max(0, cost)
          expect(plan.fromBasic + plan.fromAdditional).toBe(boundedCost)
          expect(plan.fromBasic).toBeGreaterThanOrEqual(0)
          expect(plan.fromAdditional).toBeGreaterThanOrEqual(0)
          expect(plan.fromBasic).toBeLessThanOrEqual(basic)
          if (plan.fromAdditional > 0) expect(plan.fromBasic).toBe(basic)
          expect(plan.ok).toBe(plan.fromAdditional <= additional)
        }
      }
    }
  })

  it('keeps recallCost non-decreasing in decay-depth and capped', () => {
    let previous = 0
    for (const weight of [0, 0.5, 1, 1.25, 2, 2.75, 3.5, 4, 6, 100]) {
      const got = recallCost(weight)
      expect(got).toBeGreaterThanOrEqual(previous)
      expect(got).toBeLessThanOrEqual(VALUES.twinkle.recallMaxCost)
      expect(got).toBeGreaterThanOrEqual(VALUES.twinkle.recallBaseCost)
      previous = got
    }
    expect(recallCost(1e18)).toBe(VALUES.twinkle.recallMaxCost)
  })

  it('keeps gistViewCost non-increasing in gist-depth, floored, never free', () => {
    let previous = Number.POSITIVE_INFINITY
    for (let stage = 1; stage <= 8; stage += 1) {
      const got = gistViewCost(stage)
      expect(got).toBeLessThanOrEqual(previous)
      expect(got).toBeGreaterThanOrEqual(VALUES.twinkle.gistMinCost)
      expect(got).toBeGreaterThan(0)
      previous = got
    }
    expect(gistViewCost(1)).toBe(VALUES.twinkle.gistBaseCost)
    expect(gistViewCost(0)).toBe(gistViewCost(1))
  })

  it('matches the shared Go golden fixture', () => {
    const fixture = readFixture()

    for (const testCase of fixture.cases) {
      switch (testCase.function) {
        case 'recall_cost':
          expectClose(
            recallCost(required(testCase.inputs.accessibility_cost)),
            required(testCase.expected),
            fixture.tolerance,
          )
          break
        case 'gist_view_cost':
          expectClose(
            gistViewCost(required(testCase.inputs.semantic_stage)),
            required(testCase.expected),
            fixture.tolerance,
          )
          break
        case 'plan_spend': {
          const plan = planSpend(
            required(testCase.inputs.basic_remaining),
            required(testCase.inputs.additional),
            required(testCase.inputs.cost),
          )
          const expected = required(testCase.expected_plan)
          expect(plan).toEqual({
            fromBasic: expected.from_basic,
            fromAdditional: expected.from_additional,
            ok: expected.ok,
          })
          break
        }
        case 'basic_remaining':
          expectClose(
            basicRemaining(
              required(testCase.inputs.now),
              required(testCase.inputs.reset_window),
              required(testCase.inputs.spent_this_window),
            ),
            required(testCase.expected),
            fixture.tolerance,
          )
          break
        default:
          // Mirror the Go reader's default arm: an unknown fixture function must fail, never
          // silently skip — otherwise one side stops asserting and parity quietly narrows.
          throw new Error(`unknown golden function: ${String(testCase.function)}`)
      }
    }
  })
})

function readFixture(): LedgerFixture {
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as LedgerFixture
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('golden fixture is missing a required field')
  return value
}

function expectClose(got: number, want: number, tolerance: number): void {
  expect(Math.abs(got - want)).toBeLessThanOrEqual(tolerance)
}
