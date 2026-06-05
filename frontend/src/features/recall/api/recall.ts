// Recall RPCs via the single shared Connect client (02). unary only (constitution §6).
import { memoryClient } from '@/shared/api'
import type { Record as RecordMsg } from '@/shared/api/gen/cosimosi/v1/memory_pb'

/** Re-ignite a star and read its immutable original Record (read-only panel). */
export async function recallMemory(memoryId: string): Promise<RecordMsg | undefined> {
  const res = await memoryClient.recallMemory({ memoryId })
  return res.record
}

/** Persist a co-recall reinforcement batch (idempotent by batchId). */
export async function reinforceLinks(
  items: { aId: string; bId: string; deltaWeight: number }[],
  batchId: string,
): Promise<void> {
  await memoryClient.reinforceLinks({ items, batchId })
}
