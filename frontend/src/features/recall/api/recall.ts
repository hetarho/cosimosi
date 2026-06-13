// Recall RPCs via the single shared Connect client (02). unary only (constitution §6).
// ⚠️ reinforceLinks (flush 경로)는 16에서 변경 금지 — keepalive 명령형 호출 유지(헌법 §6).
import { memoryClient } from '@/shared/api'
import { isDemoMode, demoRecall, demoMarkRecalled, demoReshape } from '@/shared/lib/demo'
import type { Record as RecordMsg } from '@/shared/api'

/** Re-ignite a star and read its immutable original Record (read-only panel). */
export async function recallMemory(memoryId: string): Promise<RecordMsg | undefined> {
  if (isDemoMode()) {
    const record = demoRecall(memoryId) // 체험: 더미 원본 일기 반환
    // 재점화(spec 19): 서버의 last_recalled_at=now를 데모 데이터에 재현 — 잠든 별이
    // 회상으로 다시 밝아지는 루프가 데모에서도 완결된다(반영은 패널의 universe 무효화).
    // 재공고화(spec 23): PE 게이트를 통과하면 그 별을 경계 안에서 다시 빚고 변천사를 쌓는다
    // (novelty 없으면 무변 — 서버 RecallMemory 흐름과 동치).
    if (record) {
      demoMarkRecalled(memoryId)
      demoReshape(memoryId)
    }
    return record
  }
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
