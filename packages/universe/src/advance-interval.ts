import { elapsedUniverseDays } from '@cosimosi/memory-logic'

// The advance interval an acceleration plays over ([T2]): the clock before/after one advance —
// read off the LaunchStars response at launch, and off the committed recall-sync interval at
// recall. Day-granular ISO date strings, matching the clock mirror; null previous = the first-ever
// launch (no prior clock — the wire carries an empty string).
export interface AdvanceInterval {
  readonly previous: string | null
  readonly current: string
}

// The launch → acceleration payload: the interval plus the awaken ids whose entry choreography is
// the launched star's *reveal* — deferred until the transition completes ([T2] case 1: accelerate,
// then the star appears). Data only (§3.2); it rides the features/accelerate-time seam.
export interface AdvanceAnnouncement {
  readonly interval: AdvanceInterval
  readonly revealNeuronIds: readonly string[]
}

// One rAF frame of the sweep, computed once for both apps: the HUD date, the veil intensity
// envelope (0 → 1 → 0 across the sweep), and whether the transition is complete. Kept pure so the
// two platform hosts share the timing and only fork the opacity write (§3.5).
export interface AdvanceSweepFrame {
  readonly universeTime: string
  readonly veilIntensity: number
  readonly done: boolean
}

// Presentation constants (code-level, the UNIVERSE_CAMERA_RIG precedent — they shape the feel of
// one transition, not product behavior; promote to a values.yaml rendering.time.* key only if a
// scalar ever needs cross-surface tuning).
export const UNIVERSE_TIME_ACCELERATION = {
  /** The floor every acceleration reads at — also the whole first-launch "time begins" beat. */
  minDurationMs: 1600,
  /** A longer time-jump reads slightly longer… */
  perDayMs: 90,
  /** …but never past this cap ([T2] is a beat, not a wait). */
  maxDurationMs: 3600,
  /** The HUD date flips through at most this many steps — a sweep, not a slot machine. */
  maxDateSteps: 24,
} as const

// A past-dated launch echoes the unmoved clock twice ({clock, clock} on the wire) and a same-day
// launch advances the clock to the date it already holds — both are an empty interval: no time
// passed, nothing to play.
export function isEmptyAdvance(interval: AdvanceInterval): boolean {
  return interval.previous === interval.current
}

export function advanceDurationMs(interval: AdvanceInterval): number {
  const days = advanceDays(interval)
  const scaled =
    UNIVERSE_TIME_ACCELERATION.minDurationMs + days * UNIVERSE_TIME_ACCELERATION.perDayMs
  return Math.min(UNIVERSE_TIME_ACCELERATION.maxDurationMs, scaled)
}

// The HUD date at progress t ∈ [0, 1]: previous → current, quantized to maxDateSteps so a long
// jump samples dates instead of flipping through every one. Integer-first (step index, then day
// count) so an exact-half boundary can't round differently from a float round-trip. Endpoints are
// exact — t=0 reads previous (or current when there is none) and t=1 always lands on current.
export function sampleAdvanceDate(interval: AdvanceInterval, t: number): string {
  if (interval.previous === null) return interval.current
  const days = advanceDays(interval)
  if (days <= 0) return interval.current
  const steps = Math.min(days, UNIVERSE_TIME_ACCELERATION.maxDateSteps)
  const clamped = Math.min(1, Math.max(0, t))
  const step = Math.round(clamped * steps)
  return addDays(interval.previous, Math.round((step * days) / steps))
}

export function advanceSweepFrame(interval: AdvanceInterval, elapsedMs: number): AdvanceSweepFrame {
  // duration is always ≥ minDurationMs (advanceDays floors at 0), so t is finite and the sweep
  // always terminates — a backwards or malformed interval can never strand the rAF loop.
  const t = Math.min(1, Math.max(0, elapsedMs / advanceDurationMs(interval)))
  return {
    universeTime: sampleAdvanceDate(interval, t),
    veilIntensity: Math.sin(Math.PI * t),
    done: t >= 1,
  }
}

// Fold a second announcement into a pending one (an announce landing mid-play): the merged sweep
// spans the earliest previous (null = the unborn clock, earliest of all) → the latest current, so
// out-of-order arrival can never invert the interval and rewind the clock. Reveal ids union.
export function mergeAdvanceAnnouncements(
  pending: AdvanceAnnouncement,
  next: AdvanceAnnouncement,
): AdvanceAnnouncement {
  const previous =
    pending.interval.previous === null || next.interval.previous === null
      ? null
      : minIso(pending.interval.previous, next.interval.previous)
  return {
    interval: { previous, current: maxIso(pending.interval.current, next.interval.current) },
    revealNeuronIds: [...pending.revealNeuronIds, ...next.revealNeuronIds],
  }
}

// The launch consequence, decided once for both apps: null → keep the immediate reveal (past-dated,
// or an empty interval where no time passed); an announcement → play the acceleration and defer the
// reveal to its completion. The optimistic insert and the GetUniverse invalidate are NOT gated on
// this — persistence and the data path stay immediate; only presentation sequences.
export function advanceAnnouncementFromLaunch(response: {
  readonly pastDated: boolean
  readonly previousUniverseTime: string
  readonly universeTime: string
  readonly newNeuronIds: readonly string[]
}): AdvanceAnnouncement | null {
  if (response.pastDated || response.universeTime === '') return null
  const interval: AdvanceInterval = {
    previous: response.previousUniverseTime === '' ? null : response.previousUniverseTime,
    current: response.universeTime,
  }
  if (isEmptyAdvance(interval)) return null
  return { interval, revealNeuronIds: response.newNeuronIds }
}

// Whole elapsed days across the interval, via the same read-time-decay helper the domain already
// uses — one definition of "elapsed universe days" so the sweep can't drift from the decay math.
// It floors at 0 and coerces a NaN/backwards input to 0, so a malformed or inverted interval reads
// as a zero-day (min-duration) sweep instead of a negative/NaN one.
function advanceDays(interval: AdvanceInterval): number {
  if (interval.previous === null) return 0
  return Math.round(elapsedUniverseDays(interval.previous, interval.current))
}

// Add whole days to an ISO date in UTC (date-only parses as UTC midnight — no timezone drift).
// Only reached with days > 0, which means `iso` already parsed cleanly in advanceDays; guarded so
// a malformed date degrades to itself rather than emitting "NaN-NaN-NaN".
function addDays(iso: string, days: number): string {
  const base = Date.parse(iso)
  if (Number.isNaN(base)) return iso
  const date = new Date(base + days * DAY_MS)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

function minIso(a: string, b: string): string {
  return a < b ? a : b
}

function maxIso(a: string, b: string): string {
  return a > b ? a : b
}

const DAY_MS = 86_400_000
