// Pure co-recall session accumulation (spec 11). No three/React/DOM (constitution
// §4, acceptance 1.9 — mobile reusable). The operational definition: an "active
// view" (≥2s dwell, confirmed by the caller) paired with the PREVIOUS active view
// adds one co-recall increment (+0.05) to that normalized pair; same pair within a
// window sums.
export type Pair = `${string}|${string}`

export const CO_RECALL_DELTA = 0.05
export const DWELL_MS = 2000
export const DEBOUNCE_IDLE_MS = 5000

// Spacing effect (spec 23, Katz 2021): re-viewing a pair after a LONGER gap reinforces
// it more than massing it in one session. The boost scales the base increment from 1×
// (just seen together) up to 1+SPACING_GAIN at a full SPACING_REF_DAYS gap. The server's
// ReinforceLinks still caps the summed weight at 1.0 — this only shapes the increment.
export const SPACING_GAIN = 1.0
export const SPACING_REF_DAYS = 1
const DAY_MS = 86_400_000

export interface RecallSession {
  deltas: Map<Pair, number>
  lastViewedId: string | null
  /** epoch ms of each pair's last co-recall increment — the spacing-effect baseline.
   *  Survives a flush (the session is spread, not recreated) so spacing persists across
   *  batches; cleared only by a source-boundary reset (new session). */
  pairLastSeen: Map<Pair, number>
  batchId: string
}

export function createSession(batchId: string): RecallSession {
  return { deltas: new Map(), lastViewedId: null, pairLastSeen: new Map(), batchId }
}

/** Normalized undirected key (a<b byte order; the server re-normalizes per collation). */
export function pairKey(a: string, b: string): Pair {
  return (a < b ? `${a}|${b}` : `${b}|${a}`) as Pair
}

/** Spacing multiplier for a co-recall increment: 1 when the pair was just seen together,
 *  rising to 1+SPACING_GAIN once the gap reaches SPACING_REF_DAYS (acceptance 2.1). */
export function spacingBoost(gapDays: number): number {
  const g = Math.max(0, Math.min(1, gapDays / SPACING_REF_DAYS))
  return 1 + SPACING_GAIN * g
}

/** Record one confirmed active view at nowMs; if it differs from the previous one, the
 *  pair gains +CO_RECALL_DELTA scaled by the spacing boost (gap since the pair was last
 *  reinforced). Same-id (re-view) just refreshes lastViewedId. nowMs is injected (the
 *  caller passes the virtual clock) — this stays pure (constitution §4). */
export function onActiveView(s: RecallSession, id: string, nowMs: number): void {
  if (s.lastViewedId && s.lastViewedId !== id) {
    const k = pairKey(s.lastViewedId, id)
    const last = s.pairLastSeen.get(k)
    const gapDays = last == null ? 0 : (nowMs - last) / DAY_MS
    s.deltas.set(k, (s.deltas.get(k) ?? 0) + CO_RECALL_DELTA * spacingBoost(gapDays))
    s.pairLastSeen.set(k, nowMs)
  }
  s.lastViewedId = id
}

export function hasPending(s: RecallSession): boolean {
  return s.deltas.size > 0
}

/** Snapshot the accumulated increments as a ReinforceLinks payload. */
export function drainDeltas(s: RecallSession): {
  items: { aId: string; bId: string; deltaWeight: number }[]
  batchId: string
} {
  const items = [...s.deltas.entries()].map(([k, w]) => {
    const [aId, bId] = k.split('|')
    return { aId, bId, deltaWeight: w }
  })
  return { items, batchId: s.batchId }
}
