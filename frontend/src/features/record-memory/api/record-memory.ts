// RecordMemory call wrapper (spec 10, reshaped by 21). Uses the shared Connect
// client (02's auth interceptor attaches the token). The server returns the
// immutable record_id immediately; the fragment stars are born asynchronously
// (extract worker) and arrive on the next GetUniverse refetch — memory_ids is
// normally empty (Architecture §4.6, constitution §6).
import { Code, ConnectError } from '@connectrpc/connect'
import { Mood, memoryClient } from '@/shared/api'
import { isDemoMode, demoAddRecord } from '@/shared/lib/demo'

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
  entryDate: string // YYYY-MM-DD
  /** 수동 감정 토글(spec 21, 1.6)이 켜졌을 때만 전달되는 선택 힌트 — AI 감지의 fallback. */
  mood?: Mood
  intensity?: number
  /** Dedup key (server skips a repeat) — pass the submit's nonce so a retried
   *  request can't create a duplicate record. */
  idempotencyKey?: string
}

export interface RecordMemoryResult {
  /** 불변 원본 id — 응답 시점에 확정. */
  recordId: string
  /** 조각 별 id들 — 보통 빈 배열(조각은 다음 GetUniverse refetch로 도착, 헌법6). */
  memoryIds: string[]
}

/** Records a diary entry; the fragment stars arrive on a later refetch. */
export async function recordMemory(input: RecordMemoryInput): Promise<RecordMemoryResult> {
  // 체험 모드: 더미 우주에서 동기 fan-out(다감정 일기 → N 별, spec 21) 후 즉시 반환.
  if (isDemoMode()) {
    const memoryIds = demoAddRecord({
      body: input.body,
      mood: input.mood ?? Mood.MOOD_UNSPECIFIED,
      intensity: input.intensity ?? 0,
      entryDate: input.entryDate,
    })
    return { recordId: memoryIds[0] ?? '', memoryIds }
  }
  const res = await memoryClient.recordMemory({
    body: input.body,
    mood: input.mood ?? Mood.MOOD_UNSPECIFIED,
    intensity: input.intensity ?? 0,
    entryDate: input.entryDate,
    idempotencyKey: input.idempotencyKey ?? '',
  })
  return { recordId: res.recordId, memoryIds: res.memoryIds }
}
