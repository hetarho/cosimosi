// RecordMemory + SegmentMemory call wrappers (spec 10, reshaped by 21). Uses the
// shared Connect client (02's auth interceptor attaches the token).
//
// The flow is now two-step: SegmentMemory runs the AI extraction SYNCHRONOUSLY
// and returns the proposed fragments WITHOUT persisting (the user reviews/edits
// them — a wrong AI split never becomes a star unseen); RecordMemory then
// persists the confirmed list in one transaction, so memory_ids is final at
// response time. Without segments the legacy async-extract path still applies
// (memory_ids empty, fragments arrive on a later GetUniverse refetch).
import { Code, ConnectError } from '@connectrpc/connect'
import type { Mood } from '@/shared/api'
import { memoryClient } from '@/shared/api'

/** 본문 최대 길이 — 서버 memory.MaxBodyRunes(4000)의 거울. [...str].length(코드 포인트)
 *  ≒ Go의 rune 수라 같은 잣대로 잰다. 제출 전 사전 차단(17) + 에러 카피가 함께 쓴다. */
export const MAX_BODY_CHARS = 4000

/** 조각 수 상한 — 서버 memory.MaxSegments(10)의 거울. AI는 최대 5개를 제안하고,
 *  검토 단계의 수동 추가까지 합쳐 이 상한을 넘지 못한다. */
export const MAX_FRAGMENTS = 10

export const BODY_TOO_LONG_MSG = '일기가 너무 길어요 — 4,000자 이내로 줄여 주세요.'

/** 빈 조각 안내 — 제출 전 사전 검증(use-record-memory)과 서버 거부 매핑이 공유. */
export const EMPTY_FRAGMENT_MSG = '비어 있는 조각이 있어요 — 내용을 채우거나 지워 주세요.'

/** SegmentMemory 클라 타임아웃 — 서버 측 데드라인(25s)·rpcserver WriteTimeout(30s)과
 *  정렬. 트랜스포트에 기본 타임아웃이 없어 이게 없으면 'segmenting' 상태가 영영 안 풀린다. */
const SEGMENT_TIMEOUT_MS = 30_000

/** RecordMemory 실패 → 폼에 보여줄 사용자 메시지(17, 2.8). InvalidArgument의 분기는
 *  서버 sentinel 문구와 짝이다 — backend/internal/memory/memory.go의 에러 메시지가
 *  바뀌면 여기도 함께 바꾼다(서버 service_test.go가 문구를 핀으로 고정). */
export function recordErrorMessage(e: unknown): string {
  if (e instanceof ConnectError && e.code === Code.InvalidArgument) {
    const m = e.rawMessage
    if (m.includes('segment text is empty')) return EMPTY_FRAGMENT_MSG
    if (m.includes('segment text exceeds')) return '조각 하나가 너무 길어요 — 줄여 주세요.'
    if (m.includes('too many segments')) return `조각은 최대 ${MAX_FRAGMENTS}개까지예요.`
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

/** SegmentMemory(분해 미리보기) 실패 → 폼 메시지. 아무것도 저장되지 않았으므로
 *  재시도 안내가 안전하다(서버가 Unavailable로 신호). */
export function segmentErrorMessage(e: unknown): string {
  if (e instanceof ConnectError && e.code === Code.InvalidArgument) {
    const m = e.rawMessage
    if (m.includes('body is empty')) return '일기 내용을 입력해 주세요.'
    if (m.includes('exceeds max length')) return BODY_TOO_LONG_MSG
    return '입력값을 확인해 주세요.'
  }
  if (e instanceof ConnectError && e.code === Code.ResourceExhausted) {
    return BODY_TOO_LONG_MSG
  }
  return '기억을 조각내지 못했어요. 잠시 후 다시 시도해 주세요.'
}

/** 검토 단계의 조각 한 장: AI 제안(segmentMemory) 또는 수동 추가. id는 React key용
 *  로컬 식별자일 뿐, 서버로 보내지 않는다(별 id는 서버가 생성 — 헌법 §3/§8). */
export interface DraftFragment {
  id: string
  text: string
  mood: Mood
  intensity: number // 0..1
  valence: number // -1..1
}

/** 일기를 조각으로 분해(미리보기) — 서버에 아무것도 저장하지 않는다. */
export async function segmentMemory(body: string): Promise<DraftFragment[]> {
  const res = await memoryClient.segmentMemory({ body }, { timeoutMs: SEGMENT_TIMEOUT_MS })
  return res.segments.map((s) => ({
    id: crypto.randomUUID(),
    text: s.text,
    mood: s.mood,
    intensity: s.intensity,
    valence: s.valence,
  }))
}

export interface RecordMemoryInput {
  body: string
  entryDate: string // YYYY-MM-DD
  /** 검토를 마친 확정 조각 목록 — 서버가 이 그대로 별을 만든다(동기 fan-out). */
  fragments: DraftFragment[]
  /** Dedup key (server skips a repeat) — pass the submit's nonce so a retried
   *  request can't create a duplicate record. */
  idempotencyKey?: string
}

export interface RecordMemoryResult {
  /** 불변 원본 id — 응답 시점에 확정. */
  recordId: string
  /** 조각 별 id들 — 확정 조각 제출이므로 응답 시점에 확정(동기 fan-out). */
  memoryIds: string[]
}

/** Records a diary entry with its user-confirmed fragments; the stars are
 *  persisted in the same transaction (synapses still arrive on a later refetch
 *  — embedding is async). 체험 모드는 이 폼 자체가 숨겨지고 DemoSimPanel이
 *  demoAddRecord로 직접 기록하므로, 여기에 데모 분기는 없다. */
export async function recordMemory(input: RecordMemoryInput): Promise<RecordMemoryResult> {
  const res = await memoryClient.recordMemory({
    body: input.body,
    entryDate: input.entryDate,
    idempotencyKey: input.idempotencyKey ?? '',
    segments: input.fragments.map((f) => ({
      text: f.text,
      mood: f.mood,
      intensity: f.intensity,
      valence: f.valence,
    })),
  })
  return { recordId: res.recordId, memoryIds: res.memoryIds }
}
