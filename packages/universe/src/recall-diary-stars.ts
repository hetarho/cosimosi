import {
  createMemoryClient,
  type ApiTransport,
  type RecallDiaryStarsResponse,
} from '@cosimosi/api-client'

import { type AdvanceAnnouncement, type AdvanceInterval } from './advance-interval.ts'

// features/recall-diary-stars api: the whole-diary recall ([D3], §2.7 unary) — 이 일기로 태어난
// 별 보기. Reinforce-only (never reconsolidation): the request carries ONLY the diary id, so the
// affected memories and the sync interval are all server-derived (§2.9#8). Sync + reinforce every
// still-live star commit atomically server-side; the FE holds no strength/time/price field.
export async function requestRecallDiaryStars(
  transport: ApiTransport,
  input: { diaryId: string },
): Promise<RecallDiaryStarsResponse> {
  return createMemoryClient(transport).recallDiaryStars({ diaryId: input.diaryId })
}

// The recall-sync interval the acceleration replays over ([T2] case 2), read from the returned
// before/after clock — mirrors recallAdvanceAnnouncement. An empty previous (unborn clock) or a
// same-day sync (no interval) yields null: nothing to accelerate. No reveal ids — the diary
// recall reinforces existing stars, it births none.
export function diaryRecallAdvanceAnnouncement(
  response: RecallDiaryStarsResponse,
): AdvanceAnnouncement | null {
  const interval: AdvanceInterval = {
    previous: response.previousUniverseTime === '' ? null : response.previousUniverseTime,
    current: response.universeTime,
  }
  if (interval.previous === null || interval.previous === interval.current) return null
  return { interval, revealNeuronIds: [] }
}
