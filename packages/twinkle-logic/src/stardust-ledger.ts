import { VALUES } from '@cosimosi/config'

// The 별가루 (Twinkle) recall-economy pure math ([G1]–[G5]), mirroring the Go
// internal/twinkle implementation for golden-parity (pinned by the shared
// stardust-ledger-golden.json fixture): the FE prices a recall or gist view pre-spend and
// shows which kind will pay, without a round-trip. Only the prices and the spend plan mirror —
// the balance itself is server-authoritative single-writer state the FE reads, never advances.

// The purpose a spend is planned against ([G4][P9]) — the mirror of the Go SpendKind. It is what
// smallEligible reads. Kept a closed union rather than a widened string: a typo'd kind would compile
// and then silently price as GENERAL-only, showing the wrong paying tier in the pre-spend preview.
export type SpendKind = 'recall' | 'gist_view' | 'diary_recall' | 'purchase'

// planSpend's per-kind draw: how much of a cost comes from SMALL and how much from GENERAL, plus
// whether the GENERAL part actually fits. It plans; it never writes.
export interface SpendPlan {
  readonly fromSmall: number
  readonly fromGeneral: number
  readonly ok: boolean
}

// resetWindowOf is the SMALL refill boundary: the user's own LOCAL calendar date as YYYY-MM-DD
// ([G2][U7]), which compares lexicographically and groups directly. null when `now` is not a
// parseable timestamp, so smallRemaining can fall back conservatively instead of over-granting.
//
// An empty, blank or unknown IANA zone reads as UTC, and so does a runtime whose Intl cannot do
// time zones at all (React Native without full ICU) — [G5] forbids a missing zone from denying a
// refill, so every fallback lands on today's shipped behavior rather than an exception.
export function resetWindowOf(now: string, zone: string): string | null {
  const parsed = parseInstant(now)
  if (parsed === null) return null
  const timeZone = zone.trim()
  if (timeZone === '') return utcDate(parsed)
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function')
      return utcDate(parsed)
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(parsed))
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    if (!year || !month || !day) return utcDate(parsed)
    return `${year.padStart(4, '0')}-${month}-${day}`
  } catch {
    return utcDate(parsed)
  }
}

// smallRemaining derives the SMALL kind from the daily grant, the reset anchor, and the SMALL spend
// inside the current window ([G2]). The window is the user's local calendar day (the economy paces
// the user's real-world daily recall habit [M5][G5]) and the reset is lazy: a `now` on a later local
// date than the anchor derives a fresh full grant (unspent prior SMALL is discarded, no carry). A
// now at/before the anchor's date — or a non-parseable input — derives conservatively as the
// anchored window (grant − spent): the derivation never over-grants.
export function smallRemaining(
  now: string,
  zone: string,
  resetWindow: string,
  spentThisWindow: number,
): number {
  const grant = VALUES.twinkle.smallDailyAmount
  const nowDate = resetWindowOf(now, zone)
  // The anchor is a stored DATE, always read in UTC — the Go side compares against
  // ResetWindowOf(resetWindow, time.UTC) for the same reason.
  const windowDate = resetWindowOf(resetWindow, 'UTC')
  if (nowDate !== null && windowDate !== null && nowDate > windowDate) return grant
  return clamp(grant - Math.max(0, spentThisWindow), 0, grant)
}

// smallEligible answers the one question the SMALL kind exists to answer ([G5][P9]): may this
// purpose be paid from today's recall allowance? A closed list with a FALSE default — an unlisted or
// later-added kind is ineligible by construction, mirroring the Go switch's default arm ([I11]).
export function smallEligible(kind: SpendKind): boolean {
  return kind === 'recall' || kind === 'gist_view' || kind === 'diary_recall'
}

// planSpend plans how a cost is drawn from the two kinds ([G2][G5][P9]). For the recall family SMALL
// is exhausted before GENERAL is touched, so everyday recall inside the daily grant never spends the
// permanent balance; for every other purpose fromSmall is 0. ok is false when the GENERAL part
// exceeds the GENERAL balance — the server refuses; this function only plans, never writes, and
// neither kind can go negative.
export function planSpend(
  smallRemainingValue: number,
  general: number,
  cost: number,
  kind: SpendKind,
): SpendPlan {
  const boundedGeneral = Math.max(0, general)
  const boundedCost = Math.max(0, cost)
  const fromSmall = smallEligible(kind)
    ? Math.min(boundedCost, Math.max(0, smallRemainingValue))
    : 0
  const fromGeneral = boundedCost - fromSmall
  return { fromSmall, fromGeneral, ok: fromGeneral <= boundedGeneral }
}

// shortfallFor is how much a spend is short of the kinds that may actually pay for it ([G4][P9]):
// SMALL counts only for an eligible purpose, so a quote for a SMALL-ineligible purpose never reports
// itself covered by an allowance it cannot spend. 0 when the plan fits.
export function shortfallFor(
  smallRemainingValue: number,
  general: number,
  cost: number,
  kind: SpendKind,
): number {
  const plan = planSpend(smallRemainingValue, general, cost, kind)
  if (plan.ok) return 0
  return plan.fromGeneral - Math.max(0, general)
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

// A zone-less datetime is pinned to UTC before parsing: Date.parse reads "2026-07-14T00:00:00" as
// LOCAL time (unlike date-only strings, which are UTC per spec), and a local-time read would shift
// the boundary by the viewer's offset — breaking parity with the Go side, which always parses an
// explicit offset. null for a non-parseable input.
function parseInstant(value: string): number | null {
  const zoneless = value.includes('T') && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const parsed = Date.parse(zoneless ? `${value}Z` : value)
  return Number.isNaN(parsed) ? null : parsed
}

function utcDate(instant: number): string {
  return new Date(instant).toISOString().slice(0, 10)
}

function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) return minValue
  if (value > maxValue) return maxValue
  return value
}
