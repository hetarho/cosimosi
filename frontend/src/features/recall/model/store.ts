// Co-recall session store (spec 11). Accumulates confirmed active views, flushes
// reinforcement after an idle debounce, and retries the SAME batchId on failure so
// the idempotent server (1.10) collapses duplicates. No three/React/DOM (1.9):
// setTimeout + crypto are RN-safe globals; the beforeunload flush lives in the UI.
import { create } from 'zustand'
import { capture, EVENTS } from '@/shared/lib'
import { isDemoMode } from '@/shared/lib/demo'
import { useSynapseStore } from '@/entities/synapse'
import { reinforceLinks } from '../api/recall'
import {
  CO_RECALL_DELTA,
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
  /** Source-boundary reset (sign-out / demo switch, 16): swap in a fresh session so the
   *  previous source's pending pairs/deltas/lastViewedId never leak into the next one.
   *  The flush MECHANISM is untouched — this only replaces the session it drains from. */
  reset: () => void
}

export const useRecallStore = create<RecallState>((set, get) => ({
  session: createSession(newBatchId()),
  recordActiveView: (id) => {
    const session = get().session
    const prev = session.lastViewedId
    onActiveView(session, id)
    // 데모 헵 미리보기(spec 19): 페어가 확정되는 즉시 그 엣지의 weight를 로컬로 올려
    // 굵어짐이 바로 보이게 한다(상한 1.0, 없던 페어는 co_recall 생성). 영속은 그대로
    // flush 경로 소유 — 데모에선 reinforceLinks가 no-op이라 서버 쓰기가 없다(11 불변).
    if (prev && prev !== id && isDemoMode()) {
      useSynapseStore.getState().bumpEdgeWeight(prev, id, CO_RECALL_DELTA)
    }
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
      // 출처 리셋이 전송 중 세션을 교체했으면 이 배치는 이전 사용자 소유 — 이벤트도
      // batchId 회전도 새 세션에 적용하지 않는다(실패 경로의 cur === s 가드와 대칭, 18).
      if (get().session === s) {
        // reinforce_flush(18) — 공동 회상(헵 강화)이 실제로 도는지. 성공 배치만 센다
        // (재시도는 같은 batchId로 합쳐지므로 성공 시점이 중복 없는 1회).
        capture(EVENTS.reinforceFlush, { pair_count: items.length })
        // success → rotate batchId; keep the deltas accumulated during the await.
        set({ session: { ...s, batchId: newBatchId() } })
      }
    } catch {
      // failure → re-merge the drained increments under the SAME batchId for retry
      // (1.7). The server dedups by batchId (1.10), so a resend never double-counts.
      // Skip if a source-boundary reset swapped the session mid-flight — reviving the
      // previous source's deltas would flush them under the next identity.
      const cur = get().session
      if (cur === s) {
        for (const it of items) {
          const k = pairKey(it.aId, it.bId)
          cur.deltas.set(k, (cur.deltas.get(k) ?? 0) + it.deltaWeight)
        }
      }
    } finally {
      inFlight = false
    }
  },
  reset: () => {
    clearFlushTimer()
    set({ session: createSession(newBatchId()) })
  },
}))
