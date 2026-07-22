import { createMemoryClient, type ApiTransport, type RecallResponse } from '@cosimosi/api-client'
import type { EpisodicMemory } from '@cosimosi/memory'

import { type AdvanceAnnouncement, type AdvanceInterval } from './advance-interval.ts'
import { useEpisodicMemoryStore } from './episodic-memory-store.ts'

// The rewrite the diarist sends to recall a memory ([R1]): the target, the rewritten account, the
// client operation id (idempotency, A2), and the explicit sync consent (A1). No seed/strength/
// decay/price field exists, so the reshape/anchors/branch/price stay server-derived (§2.9#8,
// [I3][I11]). operationId is stable across an ambiguous-failure retry (so the server replays the
// receipt); syncConsent is true only when the user accepted the sync-consent modal.
export interface RecallInput {
  readonly episodicMemoryId: string
  readonly rewriteText: string
  readonly operationId: string
  readonly syncConsent: boolean
}

// features/recall-star api: the single synchronous Recall call (§2.7 unary) — receipt check + sync
// + prediction-error compare + reinforce/(reconsolidate) commit atomically server-side. Fresh
// request shaped here so the proto DTO boundary owns the wire shape.
export async function requestRecall(
  transport: ApiTransport,
  input: RecallInput,
): Promise<RecallResponse> {
  return createMemoryClient(transport).recall({
    memoryId: input.episodicMemoryId,
    rewriteText: input.rewriteText,
    operationId: input.operationId,
    syncConsent: input.syncConsent,
  })
}

// Optimistic apply on SUCCESS only (§2.8, server-authoritative): fold the recall's returned
// authoritative representation into the read-model mirror so the star re-renders and the detail
// panel reads the fresh text — the bumped recall_count (→ brighter/larger + the decay-stage reset
// to 0, so currentDecayText returns the whole text), the reset last_recalled, the (reshaped on
// reconsolidation [V5]) seed, and the returned current_text (the new narrative on reconsolidation,
// unchanged on reinforce). Applying current_text keeps the mirror from lagging the server after a
// reconsolidation. A failed recall never calls this because there is nothing to apply.
export function applyRecallResult(memoryId: string, response: RecallResponse): void {
  const store = useEpisodicMemoryStore.getState()
  const existing = store.byId[memoryId]
  if (!existing) return
  const updated: EpisodicMemory = {
    ...existing,
    seed: response.seed,
    recallCount: response.recallCount,
    lastRecalledUniverseTime: response.universeTime,
    currentText: response.currentText,
  }
  const all = store.ids
    .map((id) => (id === memoryId ? updated : store.byId[id]))
    .filter((memory): memory is EpisodicMemory => Boolean(memory))
  store.setAll(all)
}

// The recall-sync interval the acceleration replays over ([T2] case 2): the committed
// before/after clock the server returns. Empty previous (unborn clock) or a same-day sync (no
// interval) yields null — nothing to accelerate. No reveal ids: recall reshapes an existing star,
// it births none.
export function recallAdvanceAnnouncement(response: RecallResponse): AdvanceAnnouncement | null {
  const interval: AdvanceInterval = {
    previous: response.previousUniverseTime === '' ? null : response.previousUniverseTime,
    current: response.universeTime,
  }
  if (interval.previous === null || interval.previous === interval.current) return null
  return { interval, revealNeuronIds: [] }
}
