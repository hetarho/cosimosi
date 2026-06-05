// Pure co-recall session accumulation (spec 11). No three/React/DOM (constitution
// §4, acceptance 1.9 — mobile reusable). The operational definition: an "active
// view" (≥2s dwell, confirmed by the caller) paired with the PREVIOUS active view
// adds one co-recall increment (+0.05) to that normalized pair; same pair within a
// window sums.
export type Pair = `${string}|${string}`

export const CO_RECALL_DELTA = 0.05
export const DWELL_MS = 2000
export const DEBOUNCE_IDLE_MS = 5000

export interface RecallSession {
  deltas: Map<Pair, number>
  lastViewedId: string | null
  batchId: string
}

export function createSession(batchId: string): RecallSession {
  return { deltas: new Map(), lastViewedId: null, batchId }
}

/** Normalized undirected key (a<b byte order; the server re-normalizes per collation). */
export function pairKey(a: string, b: string): Pair {
  return (a < b ? `${a}|${b}` : `${b}|${a}`) as Pair
}

/** Record one confirmed active view; if it differs from the previous one, the pair
 *  gains +CO_RECALL_DELTA. Same-id (re-view) just refreshes lastViewedId. */
export function onActiveView(s: RecallSession, id: string): void {
  if (s.lastViewedId && s.lastViewedId !== id) {
    const k = pairKey(s.lastViewedId, id)
    s.deltas.set(k, (s.deltas.get(k) ?? 0) + CO_RECALL_DELTA)
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
