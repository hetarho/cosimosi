// Immutable-original Record cache key (spec 16 §캐싱 전략). 원본 일기는 불변(헌법 §1)
// → RecallMemory 응답을 setQueryData로 한 번 시드하면 재열람은 스피너 없이 캐시에서
// 읽는다. 키와 신선도 정책을 함께 정의해 "원본 = 불변 = 영구 캐시" 불변식이 한 곳에
// 적히게 한다 — QueryClient 등록(setQueryDefaults)은 클라이언트 소유자(app)가 수행.
export const RECORD_QUERY_ROOT = 'record'

/** RECORD_QUERY_ROOT prefix의 캐시 정책: 영구 신선(불변) + 30분 보관(재열람 무스피너). */
export const RECORD_QUERY_DEFAULTS = {
  staleTime: Infinity,
  gcTime: 30 * 60_000,
} as const

/** ['record', memoryId] — 손 키(connect-query 키 아님: fetch가 아니라 시드 전용 캐시). */
export function recordQueryKey(memoryId: string): readonly [string, string] {
  return [RECORD_QUERY_ROOT, memoryId] as const
}

/** ['record', memoryId, 'fragment'] — 그 별의 조각 텍스트(spec 28). 원본과 같은 불변·영구
 *  정책을 RECORD_QUERY_ROOT prefix에서 상속(setQueryDefaults가 prefix로 매칭) → 재열람은
 *  스피너 없이 조각 텍스트도 캐시에서 즉시 보인다. RecallMemory 성공 때만 시드. */
export function fragmentTextQueryKey(memoryId: string): readonly [string, string, string] {
  return [RECORD_QUERY_ROOT, memoryId, 'fragment'] as const
}
