// Co-recall session store (spec 11). Accumulates confirmed active views, flushes
// reinforcement after an idle debounce, and retries the SAME batchId on failure so
// the idempotent server (1.10) collapses duplicates. No three/React/DOM (1.9):
// setTimeout + crypto are RN-safe globals; the beforeunload flush lives in the UI.
import { create } from 'zustand'
import { reinforceLinks } from '../api/recall'
import {
  createSession,
  DEBOUNCE_IDLE_MS,
  drainDeltas,
  hasPending,
  onActiveView,
  pairKey,
  type RecallSession,
} from './co-recall'

function newBatchId(): string {
  return crypto.randomUUID()
}

let flushTimer: ReturnType<typeof setTimeout> | null = null
let inFlight = false // serialize: at most one batch in flight (prevents double-drain)

function clearFlushTimer() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

interface RecallState {
  session: RecallSession
  /** Called once a star's panel has been actively viewed ≥2s (caller confirms dwell). */
  recordActiveView: (id: string) => void
  /** Send the accumulated batch now (debounce, beforeunload, neighbor-jump). */
  flush: () => Promise<void>
}

export const useRecallStore = create<RecallState>((set, get) => ({
  session: createSession(newBatchId()),
  recordActiveView: (id) => {
    onActiveView(get().session, id)
    clearFlushTimer()
    flushTimer = setTimeout(() => {
      void get().flush()
    }, DEBOUNCE_IDLE_MS)
  },
  flush: async () => {
    if (inFlight) return // a batch is already being sent; its drain owns those deltas
    const s = get().session
    if (!hasPending(s)) return
    clearFlushTimer()
    const { items, batchId } = drainDeltas(s)
    // Remove the drained pairs NOW so any active views during the await accumulate into
    // the NEXT batch — otherwise the success rotation below would discard them.
    for (const it of items) s.deltas.delete(pairKey(it.aId, it.bId))
    inFlight = true
    try {
      await reinforceLinks(items, batchId)
      // success → rotate batchId; keep the deltas accumulated during the await.
      set({ session: { ...get().session, batchId: newBatchId() } })
    } catch {
      // failure → re-merge the drained increments under the SAME batchId for retry
      // (1.7). The server dedups by batchId (1.10), so a resend never double-counts.
      const cur = get().session
      for (const it of items) {
        const k = pairKey(it.aId, it.bId)
        cur.deltas.set(k, (cur.deltas.get(k) ?? 0) + it.deltaWeight)
      }
    } finally {
      inFlight = false
    }
  },
}))
