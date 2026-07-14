import { VALUES } from '@cosimosi/config'

// The 별가루 (Twinkle) recall-economy pure math ([G1]–[G5]), mirroring the Go
// internal/twinkle implementation for golden-parity (pinned by the shared
// stardust-ledger-golden.json fixture): the FE prices a recall or gist view pre-spend and
// shows which tier will pay, without a round-trip. Only the prices and the spend plan mirror —
// the balance itself is server-authoritative single-writer state the FE reads, never advances.

// planSpend's per-tier draw: how much of a cost comes from basic and how much overflows to
// additional, plus whether the overflow actually fits. It plans; it never writes.
export interface SpendPlan {
  readonly fromBasic: number
  readonly fromAdditional: number
  readonly ok: boolean
}

// basicRemaining derives the basic tier from the daily grant, the reset anchor, and the basic
// spend inside the current window ([G2]). The reset window is the REAL UTC calendar day —
// deliberately distinct from universe time (the economy paces the user's real-world daily
// recall habit [M5][G5]) — and the reset is lazy: a `now` in a later UTC day than the anchor
// derives as a fresh full grant (unspent prior basic is discarded, no carry). A now at/before
// the anchor's day — or a non-parseable input — derives conservatively as the anchored window
// (grant − spent): the derivation never over-grants.
export function basicRemaining(now: string, resetWindow: string, spentThisWindow: number): number {
  const grant = VALUES.twinkle.basicDailyAmount
  const nowDay = utcDay(now)
  const windowDay = utcDay(resetWindow)
  if (nowDay !== null && windowDay !== null && nowDay > windowDay) return grant
  return clamp(grant - Math.max(0, spentThisWindow), 0, grant)
}

// planSpend plans how a cost is drawn from the two tiers ([G2][G5]): basic is exhausted before
// additional is touched, so everyday recall inside the daily grant never spends the paid
// wallet. ok is false when the overflow exceeds additional — the server rejects or charges;
// this function only plans, never writes, and neither tier can go negative.
export function planSpend(
  basicRemainingValue: number,
  additional: number,
  cost: number,
): SpendPlan {
  const boundedBasic = Math.max(0, basicRemainingValue)
  const boundedAdditional = Math.max(0, additional)
  const boundedCost = Math.max(0, cost)
  const fromBasic = Math.min(boundedCost, boundedBasic)
  const fromAdditional = boundedCost - fromBasic
  return { fromBasic, fromAdditional, ok: fromAdditional <= boundedAdditional }
}

// recallCost prices a 회고 (recall) from the accessibility/cost weight the forgetting math
// computes ([F4][G4]) — CC3: decay owns "how decayed → how inaccessible", this module alone
// owns "how inaccessible → how many Twinkle". Non-decreasing in the weight and clamped to
// twinkle.recallMaxCost so a silent engram stays recallable within a plausible balance ([G5]).
export function recallCost(accessibilityCost: number): number {
  const depth = Math.max(0, accessibilityCost)
  const cost = Math.round(
    VALUES.twinkle.recallBaseCost + VALUES.twinkle.recallDepthCoefficient * depth,
  )
  return clamp(cost, 0, VALUES.twinkle.recallMaxCost)
}

// gistViewCost prices a 요지 별 열람 from the semantic stage the semanticization math computes
// ([R8][G4]): the deeper the gist, the cheaper the skim — non-increasing in stage, floored at
// twinkle.gistMinCost (cheap but never free; the free surface is meta info and the forgotten
// current text [G1], not a gist read). Defined over the gistified stages 1..max (stage 0 has
// no gist representation to view); inputs below 1 price as stage 1.
export function gistViewCost(semanticStage: number): number {
  const stage = Math.max(1, semanticStage)
  const cost = VALUES.twinkle.gistBaseCost - VALUES.twinkle.gistStageDiscount * (stage - 1)
  return Math.max(VALUES.twinkle.gistMinCost, cost)
}

// The reset-window rule, date(now, UTC), as a comparable whole-day count — identical to the Go
// utcDay for post-epoch timestamps. The rule itself is code, not a value (the values.yaml
// exclusion rule). A zone-less datetime is pinned to UTC before parsing: Date.parse reads
// "2026-07-14T00:00:00" as LOCAL time (unlike date-only strings, which are UTC per spec), and
// a local-time read would shift the day boundary by the viewer's offset — breaking parity
// with the Go side, which is always UTC. A non-parseable input reads as null so
// basicRemaining falls back conservatively.
function utcDay(value: string): number | null {
  const zoneless = value.includes('T') && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const parsed = Date.parse(zoneless ? `${value}Z` : value)
  if (Number.isNaN(parsed)) return null
  return Math.floor(parsed / 86_400_000)
}

function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) return minValue
  if (value > maxValue) return maxValue
  return value
}
