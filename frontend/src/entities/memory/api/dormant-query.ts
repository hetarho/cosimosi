// ListDormant query (spec 12, queried in 16). 키+queryFn+캐시 정책(서버 상태의 정체성)은
// 엔터티가 소유한다 — 소비처가 두 레이어(features/dormant-search의 목록 오버레이, features/recall의
// 회상 성공 invalidate)에 걸쳐 있기 때문(공통 하위 레이어 = entity). 뷰 모델 매핑
// (DormantStar select)은 features/dormant-search가 가진다.
import { callUnaryMethod, createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query'
import { queryOptions } from '@tanstack/react-query'
import { create } from '@bufbuild/protobuf'
import {
  ListDormantResponseSchema,
  MemoryService,
  transport,
  type ListDormantResponse,
} from '@/shared/api'
import { isDemoMode, demoStars, virtualNowMs } from '@/shared/lib/demo'
import { isDormant } from '../model/activation'
import { parseEpochMs } from '../model/time'

// 잠듦 임계(~100일)의 초저속 데이터 — 5분 신선이면 충분하다(spec 16 §캐싱 전략).
const DORMANT_STALE_MS = 5 * 60_000
const DORMANT_GC_MS = 10 * 60_000

function buildDormantQueryOptions() {
  const base = createQueryOptions(MemoryService.method.listDormant, {}, { transport })
  return queryOptions({
    ...base,
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<ListDormantResponse> => {
      // 체험 모드: 서버가 하던 잠듦 필터를 클라에서 동일 규칙(isDormant)으로 재현한다.
      // now는 가상 시계(spec 19) — 시간 머신이 보낸 시간만큼 잠든 별이 늘어난다.
      if (isDemoMode()) {
        const now = virtualNowMs()
        const stars = demoStars().filter((s) => isDormant(parseEpochMs(s.lastRecalledAt, now), now))
        return Promise.resolve(create(ListDormantResponseSchema, { stars }))
      }
      return callUnaryMethod(transport, MemoryService.method.listDormant, {}, { signal })
    },
    staleTime: DORMANT_STALE_MS,
    gcTime: DORMANT_GC_MS,
    // focus refetch는 전역 기본(false) 유지 — 갱신 트리거는 RecallMemory 성공 invalidate.
  })
}

// 옵션 1회 생성·재사용(검색 키 입력마다 리렌더되는 DormantSheet에서 protobuf 키 재생성 방지).
let dormantOptionsCache: ReturnType<typeof buildDormantQueryOptions> | undefined

/** ListDormant 쿼리 옵션(키+fetch+캐시 정책). 뷰 모델 select는 소비처가 얹는다. */
export function dormantQueryOptions() {
  return (dormantOptionsCache ??= buildDormantQueryOptions())
}

/** ListDormant 부분 키(transport·input 생략 → 모든 변형 매치) — invalidate 전용(1.6:
 *  회상된 별은 잠에서 깸 → 다음 잠든 별 오버레이 진입 시 목록에서 제외). */
export function dormantInvalidateKey() {
  return createConnectQueryKey({ schema: MemoryService.method.listDormant, cardinality: 'finite' })
}
