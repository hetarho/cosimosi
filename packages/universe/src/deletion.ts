import {
  createMemoryClient,
  type ApiTransport,
  type LetGoResponse,
  type ReleaseResponse,
  type RestoreResponse,
  type SuggestLetGoResponse,
} from '@cosimosi/api-client'
import type { EpisodicMemory } from '@cosimosi/memory'

import { useEpisodicMemoryStore } from './episodic-memory-store.ts'
import { useReleasedGroupsStore } from './released-groups-store.ts'

// features/delete-memory api ([X1][X2], §2.7 unary): full delete. The request carries ONLY the
// diary id — the affected ids, the soft-delete window, and the orphan-neuron sealing are all
// server-derived ([I3][I11]). One unary call, no polling.
export async function requestRelease(
  transport: ApiTransport,
  input: { diaryId: string },
): Promise<ReleaseResponse> {
  return createMemoryClient(transport).release({ diaryId: input.diaryId })
}

// features/restore-memory api ([X2], §2.7 unary): reverse a full delete still inside its window.
// The request carries ONLY the diary id.
export async function requestRestore(
  transport: ApiTransport,
  input: { diaryId: string },
): Promise<RestoreResponse> {
  return createMemoryClient(transport).restore({ diaryId: input.diaryId })
}

// features/let-go api step 1 ([X6], §2.7 unary): the diarist's typed words are sent; the response
// returns the AI-identified this-memory-only semantic candidates + the heavy-state hint. AI
// suggests only — nothing is sealed by this call.
export async function requestSuggestLetGo(
  transport: ApiTransport,
  input: { episodicMemoryId: string; words: string },
): Promise<SuggestLetGoResponse> {
  return createMemoryClient(transport).suggestLetGo({
    episodicMemoryId: input.episodicMemoryId,
    words: input.words,
  })
}

// features/let-go api step 2 ([X4][X5][X6], §2.7 unary): seal the user-approved subset, permanent,
// no timer. The request carries ONLY the episodic memory id + the approved neuron ids — no emotion
// / position / color / strength / time field, and no way to seal a shared/foreign neuron (the
// domain re-validates each id, [I3][I11]).
export async function requestLetGo(
  transport: ApiTransport,
  input: { episodicMemoryId: string; approvedNeuronIds: readonly string[] },
): Promise<LetGoResponse> {
  return createMemoryClient(transport).letGo({
    episodicMemoryId: input.episodicMemoryId,
    approvedNeuronIds: [...input.approvedNeuronIds],
  })
}

// Optimistic apply on Release SUCCESS (§2.8, server-authoritative): remove every returned id from
// the episodic-memory mirror so the canvas stops rendering those stars with no residual pull
// ([X3][I5]), and record the group (with the removed snapshots + real-clock `deletedAt`) so the
// restore surface can list it inside its window ([X2]). A failed Release never calls this — nothing
// to roll back.
export function applyReleaseResult(response: ReleaseResponse): void {
  const removedIds = new Set(response.episodicMemoryIds)
  const store = useEpisodicMemoryStore.getState()
  const removedMemories: EpisodicMemory[] = []
  const remaining: EpisodicMemory[] = []
  for (const id of store.ids) {
    const memory = store.byId[id]
    if (!memory) continue
    if (removedIds.has(id)) removedMemories.push(memory)
    else remaining.push(memory)
  }
  store.setAll(remaining)
  useReleasedGroupsStore.getState().record({
    diaryId: response.diaryId,
    deletedAt: response.deletedAt,
    episodicMemoryIds: response.episodicMemoryIds,
    removedMemories,
  })
}

// Optimistic apply on Restore SUCCESS (§2.8): re-insert the group's captured snapshots into the
// episodic-memory mirror (dedupe by id — a GetUniverse may already carry them) and drop the group.
// The full graph re-settles on the next read.
export function applyRestoreResult(diaryId: string): void {
  const group = useReleasedGroupsStore.getState().groups.find((g) => g.diaryId === diaryId)
  const released = useReleasedGroupsStore.getState()
  if (group && group.removedMemories.length > 0) {
    const store = useEpisodicMemoryStore.getState()
    const present = new Set(store.ids)
    const reinserted = group.removedMemories.filter((memory) => !present.has(memory.id))
    if (reinserted.length > 0) {
      const all = store.ids
        .map((id) => store.byId[id])
        .filter((memory): memory is EpisodicMemory => Boolean(memory))
      store.setAll([...all, ...reinserted])
    }
  }
  released.drop(diaryId)
}
