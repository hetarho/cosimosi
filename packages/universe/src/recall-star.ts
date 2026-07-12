import { createMemoryClient, type ApiTransport, type RecallResponse } from '@cosimosi/api-client'
import type { EpisodicMemory } from '@cosimosi/memory'

import { type AdvanceAnnouncement, type AdvanceInterval } from './advance-interval.ts'
import { useEpisodicMemoryStore } from './episodic-memory-store.ts'

// The rewrite the diarist sends to recall a memory ([R1]): the target and the rewritten account —
// the only content the client sends. No seed/strength/decay/price/time field exists, so the
// reshape/anchors/branch are all server-derived (§2.9#8, [I3][I11]).
export interface RecallInput {
  readonly episodicMemoryId: string
  readonly rewriteText: string
}

// features/recall-star api: the single synchronous Recall call (§2.7 unary) — sync + prediction-error
// compare + reinforce/(reconsolidate) commit atomically server-side. Fresh request shaped here so
// the proto DTO boundary owns the wire shape; the request carries only the two fields (A5).
export async function requestRecall(
  transport: ApiTransport,
  input: RecallInput,
): Promise<RecallResponse> {
  return createMemoryClient(transport).recall({
    memoryId: input.episodicMemoryId,
    rewriteText: input.rewriteText,
  })
}

// Optimistic apply on SUCCESS only (§2.8, server-authoritative): fold the recall's returned anchors
// into the read-model mirror so the star re-renders — a reshaped body on reconsolidation (new seed,
// [V5]) and a brighter/larger body from the recall bump (recall_count → EffectiveStrength). The
// mirror holds no current_text (that is the panel's deferred read), so only seed/recall_count/
// last_recalled are applied. A failed recall never calls this (nothing to roll back, A8).
export function applyRecallResult(memoryId: string, response: RecallResponse): void {
  const store = useEpisodicMemoryStore.getState()
  const existing = store.byId[memoryId]
  if (!existing) return
  const updated: EpisodicMemory = {
    ...existing,
    seed: response.seed,
    recallCount: response.recallCount,
    lastRecalledUniverseTime: response.universeTime,
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
