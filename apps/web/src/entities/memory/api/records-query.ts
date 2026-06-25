// ListRecords query (spec 28, queried via 16's connect-query layer): the original-diary list
// that powers "원본 일기로 별 찾기". The query IDENTITY lives in the
// entity (not the feature) because its consumers span layers — DiarySheet (features/diary-list)
// READS it, and record-memory INVALIDATES it on a successful write (features can't import each
// other). Read-only: records is immutable (헌법1); the body is a short excerpt only (the whole
// original comes from RecallMemory). No three/React/DOM (헌법4 — RN reusable).
import { callUnaryMethod, createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query'
import { queryOptions } from '@tanstack/react-query'
import { create } from '@bufbuild/protobuf'
import {
  ListRecordsResponseSchema,
  MemoryService,
  transport,
  type ListRecordsResponse,
} from '@/shared/api'
import { isDemoMode, demoListRecords } from '@/shared/lib/demo'

// 일기는 append-only(거의 안 바뀌고 별 개수만 새 기록에 늘어난다) — 1분 신선 + 기록 성공 시
// 이벤트 무효화(record-memory)가 갱신을 끈다(dormant가 회상 성공에 무효화되는 것과 같은 결).
const RECORDS_STALE_MS = 60_000
const RECORDS_GC_MS = 5 * 60_000

function buildRecordsQueryOptions() {
  const base = createQueryOptions(MemoryService.method.listRecords, {}, { transport })
  return queryOptions({
    ...base,
    // 체험 모드: 서버 대신 더미 우주의 record 그룹을 같은 쿼리 경로로 태운다(spec 19/28 데모).
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<ListRecordsResponse> =>
      isDemoMode()
        ? Promise.resolve(create(ListRecordsResponseSchema, { records: demoListRecords() }))
        : callUnaryMethod(transport, MemoryService.method.listRecords, {}, { signal }),
    staleTime: RECORDS_STALE_MS,
    gcTime: RECORDS_GC_MS,
  })
}

// 옵션 1회 생성·재사용(검색 키 입력마다 리렌더되는 DiarySheet에서 protobuf 키 재생성 방지).
let recordsOptionsCache: ReturnType<typeof buildRecordsQueryOptions> | undefined

/** ListRecords 쿼리 옵션(키+fetch+캐시 정책). 뷰(DiarySheet)는 RecordSummary를 그대로 그린다. */
export function recordsQueryOptions() {
  return (recordsOptionsCache ??= buildRecordsQueryOptions())
}

/** ListRecords 부분 키 — invalidate 전용(기록 성공 시 새 일기가 목록에 바로 뜨게, record-memory). */
export function recordsInvalidateKey() {
  return createConnectQueryKey({ schema: MemoryService.method.listRecords, cardinality: 'finite' })
}
