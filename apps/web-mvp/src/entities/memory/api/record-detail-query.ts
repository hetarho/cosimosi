// GetRecord query (spec 28, change 09 — the standalone read-only diary page). Unlike
// record-query.ts (which only defines the recall-seeded cache key for the immutable
// Record) this FETCHES one original by record_id via the side-effect-free GetRecord RPC:
// reading a diary in the journal must NOT re-ignite its stars. The query identity lives in
// the entity (its consumer — pages/diary — is above; the entity is the shared lower layer).
// Read-only: records is immutable (헌법1). No three/React/DOM (헌법4 — RN reusable).
import { callUnaryMethod, createQueryOptions } from '@connectrpc/connect-query'
import { queryOptions } from '@tanstack/react-query'
import { create } from '@bufbuild/protobuf'
import {
  GetRecordResponseSchema,
  MemoryService,
  transport,
  type GetRecordResponse,
} from '@/shared/api'
import { isDemoMode, demoGetRecord } from '@/shared/lib/demo'

// 원본 일기는 불변(헌법1) → 한 번 읽으면 영구 신선, 30분 보관(재열람 무스피너). record-query의
// RECORD_QUERY_DEFAULTS와 같은 "원본=불변=영구 캐시" 결.
const RECORD_DETAIL_GC_MS = 30 * 60_000

/** GetRecord 쿼리 옵션(record_id로 원본 전문 읽기, spec 28). 빈 id면 비활성. */
export function recordDetailQueryOptions(recordId: string) {
  const base = createQueryOptions(MemoryService.method.getRecord, { recordId }, { transport })
  return queryOptions({
    ...base,
    // 체험 모드: 서버 대신 더미 우주에서 record_id로 원본을 찾는다(부작용 없음).
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<GetRecordResponse> =>
      isDemoMode()
        ? Promise.resolve(create(GetRecordResponseSchema, { record: demoGetRecord(recordId) }))
        : callUnaryMethod(transport, MemoryService.method.getRecord, { recordId }, { signal }),
    staleTime: Infinity,
    gcTime: RECORD_DETAIL_GC_MS,
    enabled: recordId.length > 0,
  })
}
