import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import {
  gistViewCost,
  planSpend,
  recallCost,
  resetWindowOf,
  shortfallFor,
  smallEligible,
  smallRemaining,
  type SpendKind,
} from './stardust-ledger.ts'

interface LedgerFixture {
  readonly tolerance: number
  readonly values: {
    readonly small_daily_amount: number
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
  readonly function: 'recall_cost' | 'gist_view_cost' | 'plan_spend' | 'small_remaining'
  readonly inputs: {
    readonly accessibility_cost?: number
    readonly semantic_stage?: number
    readonly small_remaining?: number
    readonly general?: number
    readonly cost?: number
    readonly kind?: string
    readonly now?: string
    readonly zone?: string
    readonly reset_window?: string
    readonly spent_this_window?: number
  }
  readonly expected?: number
  readonly expected_plan?: {
    readonly from_small: number
    readonly from_general: number
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
      small_daily_amount: VALUES.twinkle.smallDailyAmount,
      recall_base_cost: VALUES.twinkle.recallBaseCost,
      recall_depth_coefficient: VALUES.twinkle.recallDepthCoefficient,
      recall_max_cost: VALUES.twinkle.recallMaxCost,
      gist_base_cost: VALUES.twinkle.gistBaseCost,
      gist_stage_discount: VALUES.twinkle.gistStageDiscount,
      gist_min_cost: VALUES.twinkle.gistMinCost,
    })
  })

  it('reads resetWindowOf as the user local calendar date, with UTC as the only fallback', () => {
    // One instant, three zones, three dates — the boundary belongs to the user ([G2][U7]).
    expect(resetWindowOf('2026-07-14T23:00:00Z', 'UTC')).toBe('2026-07-14')
    expect(resetWindowOf('2026-07-14T23:00:00Z', 'Asia/Seoul')).toBe('2026-07-15')
    expect(resetWindowOf('2026-07-14T23:00:00Z', 'Pacific/Niue')).toBe('2026-07-14')
    expect(resetWindowOf('2026-07-14T11:00:00Z', 'Pacific/Kiritimati')).toBe('2026-07-15')

    // [G5]: empty, blank and unknown zones all read as UTC and never throw.
    for (const zone of ['', '   ', 'Not/AZone', 'Mars/Olympus']) {
      expect(resetWindowOf('2026-07-14T23:00:00Z', zone)).toBe('2026-07-14')
    }
    // A zone-less datetime is pinned to UTC, not the viewer's local zone (Go parity).
    expect(resetWindowOf('2026-07-14T23:59:59', 'UTC')).toBe('2026-07-14')
    expect(resetWindowOf('not a time', 'UTC')).toBeNull()
  })

  it('keeps smallRemaining daily-reset, non-carrying, and never negative', () => {
    const grant = VALUES.twinkle.smallDailyAmount

    // A fresh local day yields the full grant no matter the prior window's spend — no carry.
    for (const spent of [0, 1, 50, grant, grant + 30]) {
      expect(smallRemaining('2026-07-15T00:00:00Z', 'UTC', '2026-07-14', spent)).toBe(grant)
    }

    // Inside the window: grant − spent, floored at 0.
    expect(smallRemaining('2026-07-14T09:00:00Z', 'UTC', '2026-07-14', 40)).toBe(grant - 40)
    expect(smallRemaining('2026-07-14T09:00:00Z', 'UTC', '2026-07-14', grant)).toBe(0)
    expect(smallRemaining('2026-07-14T09:00:00Z', 'UTC', '2026-07-14', grant + 30)).toBe(0)

    // The boundary is exact in the reading zone: 23:59:59 same window, midnight fresh.
    expect(smallRemaining('2026-07-14T23:59:59Z', 'UTC', '2026-07-14', 30)).toBe(grant - 30)
    expect(smallRemaining('2026-07-15T00:00:00Z', 'UTC', '2026-07-14', 30)).toBe(grant)

    // The same instant is a NEW window for a Seoul diarist and the SAME one in UTC — the whole
    // point of the [U7] correction.
    expect(smallRemaining('2026-07-14T16:00:00Z', 'Asia/Seoul', '2026-07-14', 30)).toBe(grant)
    expect(smallRemaining('2026-07-14T16:00:00Z', 'UTC', '2026-07-14', 30)).toBe(grant - 30)

    // A stale/non-parseable now never over-grants (conservative same-window derivation).
    expect(smallRemaining('2026-07-13T12:00:00Z', 'UTC', '2026-07-14', 30)).toBe(grant - 30)
    expect(smallRemaining('not a time', 'UTC', '2026-07-14', 30)).toBe(grant - 30)
  })

  it('keeps smallEligible closed with a false default', () => {
    for (const kind of ['recall', 'gist_view', 'diary_recall'] satisfies SpendKind[]) {
      expect(smallEligible(kind)).toBe(true)
    }
    // [P9][I11]: an unlisted kind is ineligible. The casts are the point — the union keeps a typo
    // out at compile time, and these prove the RUNTIME default is still false for anything the
    // server might one day send that this build has never heard of.
    for (const kind of ['purchase', '', 'recall ', 'ornament_purchase', 'a_future_kind']) {
      expect(smallEligible(kind as SpendKind)).toBe(false)
    }
  })

  it('keeps planSpend SMALL-first for recall, GENERAL-only otherwise, exact and never negative', () => {
    for (const kind of [
      'recall',
      'gist_view',
      'diary_recall',
      'purchase',
      'a_future_kind',
    ] as SpendKind[]) {
      const eligible = smallEligible(kind)
      for (const small of [0, 1, 10, 50, 100]) {
        for (const general of [0, 1, 25, 500]) {
          for (const cost of [-5, 0, 1, 10, 60, 100, 151, 700]) {
            const plan = planSpend(small, general, cost, kind)
            const boundedCost = Math.max(0, cost)
            expect(plan.fromSmall + plan.fromGeneral).toBe(boundedCost)
            expect(plan.fromSmall).toBeGreaterThanOrEqual(0)
            expect(plan.fromGeneral).toBeGreaterThanOrEqual(0)
            expect(plan.fromSmall).toBeLessThanOrEqual(small)
            if (!eligible) expect(plan.fromSmall).toBe(0)
            if (eligible && plan.fromGeneral > 0) expect(plan.fromSmall).toBe(small)
            expect(plan.ok).toBe(plan.fromGeneral <= general)
          }
        }
      }
    }

    // The kind split at ONE balance: what a recall covers out of SMALL, a purchase cannot ([G5]).
    expect(planSpend(100, 0, 40, 'recall')).toEqual({ fromSmall: 40, fromGeneral: 0, ok: true })
    expect(planSpend(100, 0, 40, 'purchase')).toEqual({ fromSmall: 0, fromGeneral: 40, ok: false })
  })

  it('keeps shortfallFor kind-aware', () => {
    expect(shortfallFor(100, 0, 40, 'recall')).toBe(0)
    expect(shortfallFor(100, 0, 40, 'purchase')).toBe(40)
    expect(shortfallFor(30, 10, 70, 'recall')).toBe(30)
    expect(shortfallFor(0, -5, 20, 'recall')).toBe(20)
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
            required(testCase.inputs.small_remaining),
            required(testCase.inputs.general),
            required(testCase.inputs.cost),
            required(testCase.inputs.kind) as SpendKind,
          )
          const expected = required(testCase.expected_plan)
          expect(plan).toEqual({
            fromSmall: expected.from_small,
            fromGeneral: expected.from_general,
            ok: expected.ok,
          })
          break
        }
        case 'small_remaining':
          expectClose(
            smallRemaining(
              required(testCase.inputs.now),
              required(testCase.inputs.zone),
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
