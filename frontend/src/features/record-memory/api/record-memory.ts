// RecordMemory call wrapper (spec 10). Uses the shared Connect client (02's auth
// interceptor attaches the token). The server returns only memory_id — the client
// already holds body/mood for the optimistic star (Architecture §4.6).
import { memoryClient } from '@/shared/api'
import { isDemoMode, demoAddRecord } from '@/shared/demo'
import type { Mood } from '@/shared/api/gen/cosimosi/v1/memory_pb'

export interface RecordMemoryInput {
  body: string
  mood: Mood
  intensity: number
  entryDate: string // YYYY-MM-DD
  /** Dedup key (server skips a repeat) — pass the submit's temp id so a retried
   *  request can't create a duplicate record. */
  idempotencyKey?: string
}

/** Records a diary entry; resolves to the new memory id. */
export async function recordMemory(input: RecordMemoryInput): Promise<string> {
  // 체험 모드: 더미 우주에 별을 추가하고 새 id를 즉시 반환(네트워크 없음).
  if (isDemoMode()) {
    return demoAddRecord({
      body: input.body,
      mood: input.mood,
      intensity: input.intensity,
      entryDate: input.entryDate,
    })
  }
  const res = await memoryClient.recordMemory({
    body: input.body,
    mood: input.mood,
    intensity: input.intensity,
    entryDate: input.entryDate,
    idempotencyKey: input.idempotencyKey ?? '',
  })
  return res.memoryId
}
