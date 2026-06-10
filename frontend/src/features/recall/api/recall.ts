// Recall RPCs via the single shared Connect client (02). unary only (constitution §6).
// ⚠️ reinforceLinks (flush 경로)는 16에서 변경 금지 — keepalive 명령형 호출 유지(헌법 §6).
import { memoryClient } from '@/shared/api'
import { isDemoMode, demoRecall } from '@/shared/lib/demo'
import type { Record as RecordMsg } from '@/shared/api'

/** Re-ignite a star and read its immutable original Record (read-only panel). */
export async function recallMemory(memoryId: string): Promise<RecordMsg | undefined> {
  if (isDemoMode()) return demoRecall(memoryId) // 체험: 더미 원본 일기 반환
  const res = await memoryClient.recallMemory({ memoryId })
  return res.record
}

/** Persist a co-recall reinforcement batch (idempotent by batchId). */
export async function reinforceLinks(
  items: { aId: string; bId: string; deltaWeight: number }[],
  batchId: string,
): Promise<void> {
  if (isDemoMode()) return // 체험: 강화 영속화 없음(no-op)
  await memoryClient.reinforceLinks({ items, batchId })
}
