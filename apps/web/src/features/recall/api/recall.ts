// Recall RPCs via the single shared Connect client (02). unary only (constitution §6).
// 별 클릭 = 부작용 없는 peekMemory(읽기전용 열람), 명시적 회상하기 버튼 = recallMemory(부작용 + 쿨다운, change 35).
// ⚠️ reinforceLinks (flush 경로)는 16에서 변경 금지 — keepalive 명령형 호출 유지(헌법 §6).
import { memoryClient } from '@/shared/api'
import { isWriteBlocked } from '@/shared/lib'
import {
  isDemoMode,
  virtualNowMs,
  demoRecall,
  demoFragmentText,
  demoRecallGate,
  demoMarkRecalled,
  demoReshape,
} from '@/shared/lib/demo'
import type { Record as RecordMsg } from '@/shared/api'
import { RECALL_COOLDOWN_MS, recallCooldownRemainingMs } from '../model/cooldown'

/** A star's content read-only: the immutable original Record + this star's own fragment text
 *  (spec 28; "" when single-fragment / pre-21 → the panel falls back to the whole body) + the
 *  current AI-rewritten display text (spec 54; "" when never rewritten → fragment/body). The
 *  immutable original always stays in `record.body` (헌법1). */
export interface PeekResult {
  record: RecordMsg
  fragmentText: string
  derivedText: string
}

/** A recall result: the read-only content (as PeekResult) plus whether the call actually
 *  recalled (ran the side effects) or was refused by the re-recall cooldown (change 35).
 *  When `recalled` is false, `cooldownRemainingMs` > 0 says how long until the next recall. */
export interface RecallResult extends PeekResult {
  recalled: boolean
  cooldownRemainingMs: number
}

/** Read a star's content WITHOUT any side effect (change 35) — a bare star click opens the
 *  read-only panel through this (no re-ignition/reshape/co-recall). Returns undefined when the
 *  star/record is absent. */
export async function peekMemory(memoryId: string): Promise<PeekResult | undefined> {
  if (isDemoMode()) {
    const record = demoRecall(memoryId) // 체험: 더미 원본 일기 반환(부작용 없음 — demoMarkRecalled 안 함)
    return record
      ? { record, fragmentText: demoFragmentText(memoryId), derivedText: '' }
      : undefined
  }
  const res = await memoryClient.peekMemory({ memoryId })
  return res.record
    ? { record: res.record, fragmentText: res.fragmentText, derivedText: res.derivedText }
    : undefined
}

/** Deliberately recall a star (the 회상하기 button) — re-ignite + PE-gated reshape + co-recall,
 *  unless the re-recall cooldown is still running (change 35; BE-authoritative, demo mirrors it
 *  against the virtual clock). Returns undefined when the star/record is absent. */
export async function recallMemory(memoryId: string): Promise<RecallResult | undefined> {
  // 겹쳐보기(spec 37)는 순수 읽기 뷰 — 회상 재점화(쓰기)를 게이트로 막는다(3.1). 구조적으로도
  // overlay엔 회상 패널이 안 뜨지만, 어떤 UI가 붙든 쓰기 경로에서 한 번 더 차단한다(상태가 출처).
  if (isWriteBlocked()) return undefined
  if (isDemoMode()) {
    const record = demoRecall(memoryId) // 체험: 더미 원본 일기 반환
    if (!record) return undefined
    const content = { record, fragmentText: demoFragmentText(memoryId), derivedText: '' }
    // 쿨다운 게이트(change 35): 마지막 회상 후 미경과면 부작용 없이 잔여만 돌린다 — 서버 권위 강제의 데모 대응.
    const gate = demoRecallGate(memoryId)
    const remaining = gate
      ? recallCooldownRemainingMs(gate.recallCount, gate.lastRecalledAtMs, virtualNowMs())
      : 0
    if (remaining > 0) return { ...content, recalled: false, cooldownRemainingMs: remaining }
    // 재점화(spec 19): 서버의 last_recalled_at=now를 데모 데이터에 재현 — 잠든 별이 회상으로 다시
    // 밝아지는 루프가 데모에서도 완결된다(반영은 패널의 universe 무효화). 재공고화(spec 23): PE 게이트를
    // 통과하면 그 별을 경계 안에서 다시 빚고 변천사를 쌓는다(novelty 없으면 무변 — 서버 흐름과 동치).
    demoMarkRecalled(memoryId)
    demoReshape(memoryId)
    // 데모는 내용 변형(spec 54)을 하지 않는다 — derivedText "" → 기존 내용으로 정상 렌더(A5, 형태만 변함).
    // 성사 직후엔 방금 시작된 전체 쿨다운을 돌려 버튼을 즉시 잠근다(서버 동치).
    return { ...content, recalled: true, cooldownRemainingMs: RECALL_COOLDOWN_MS }
  }
  const res = await memoryClient.recallMemory({ memoryId })
  return res.record
    ? {
        record: res.record,
        fragmentText: res.fragmentText,
        derivedText: res.derivedText,
        recalled: res.recalled,
        cooldownRemainingMs: Number(res.cooldownRemainingMs),
      }
    : undefined
}

/** Persist a co-recall reinforcement batch (idempotent by batchId). */
export async function reinforceLinks(
  items: { aId: string; bId: string; deltaWeight: number }[],
  batchId: string,
): Promise<void> {
  if (isWriteBlocked()) return // 겹쳐보기(3.1): 공명 강화 쓰기도 게이트로 막는다(상태가 출처)
  if (isDemoMode()) return // 체험: 강화 영속화 없음(no-op)
  await memoryClient.reinforceLinks({ items, batchId })
}
