// RecordMemory call wrapper (spec 10). Uses the shared Connect client (02's auth
// interceptor attaches the token). The server returns only memory_id — the client
// already holds body/mood for the optimistic star (Architecture §4.6).
import { Code, ConnectError } from '@connectrpc/connect'
import { memoryClient } from '@/shared/api'
import { isDemoMode, demoAddRecord } from '@/shared/lib/demo'
import type { Mood } from '@/shared/api'

/** 본문 최대 길이 — 서버 memory.MaxBodyRunes(4000)의 거울. [...str].length(코드 포인트)
 *  ≒ Go의 rune 수라 같은 잣대로 잰다. 제출 전 사전 차단(17) + 에러 카피가 함께 쓴다. */
export const MAX_BODY_CHARS = 4000

export const BODY_TOO_LONG_MSG = '일기가 너무 길어요 — 4,000자 이내로 줄여 주세요.'

/** RecordMemory 실패 → 폼에 보여줄 사용자 메시지(17, 2.8). InvalidArgument의 분기는
 *  서버 sentinel 문구와 짝이다 — backend/internal/memory/memory.go의 에러 메시지가
 *  바뀌면 여기도 함께 바꾼다(서버 service_test.go가 문구를 핀으로 고정). */
export function recordErrorMessage(e: unknown): string {
  if (e instanceof ConnectError && e.code === Code.InvalidArgument) {
    const m = e.rawMessage
    if (m.includes('body is empty')) return '일기 내용을 입력해 주세요.'
    if (m.includes('exceeds max length')) return BODY_TOO_LONG_MSG
    if (m.includes('intensity')) return '감정 강도 값이 올바르지 않아요. 슬라이더를 다시 조절해 주세요.'
    if (m.includes('entry_date')) return '날짜 형식이 올바르지 않아요.'
    return '입력값을 확인해 주세요.'
  }
  // 256KB 메시지 상한(rpcserver)을 넘으면 핸들러 검증 전에 거부된다 — 영구 조건이라
  // "잠시 후 재시도"가 아니라 길이 안내로 (클라 사전 검증을 우회한 극단 케이스 방어).
  if (e instanceof ConnectError && e.code === Code.ResourceExhausted) {
    return BODY_TOO_LONG_MSG
  }
  return '별을 띄우지 못했어요. 잠시 후 다시 시도해 주세요.'
}

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
