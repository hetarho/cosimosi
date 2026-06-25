// Pure co-recall session accumulation (spec 11). No three/React/DOM (constitution
// §4, acceptance 1.9 — mobile reusable). The operational definition: a "recall" (the
// deliberate 회상하기 button, change 35) paired with the PREVIOUS recall adds one fixed
// co-recall increment (+CO_RECALL_DELTA) to that normalized pair; the same pair within a
// window sums. The reinforcement is a flat amount regardless of how long since the pair was
// last seen (change 22 — no spacing effect: 몰아보기 1× = 하루 띄움 1×).
import { VALUES } from '@/shared/config'

export type Pair = `${string}|${string}`

export const CO_RECALL_DELTA = VALUES.recall.coRecallDelta
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

/** Record one confirmed recall (the 회상하기 button, change 35); if it differs from the
 *  previous one, the pair gains a fixed +CO_RECALL_DELTA (server caps the summed weight at
 *  1.0). Same-id (re-recall) just refreshes lastViewedId. Pure (constitution §4). */
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
