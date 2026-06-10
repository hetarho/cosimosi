import { QueryClient } from '@tanstack/react-query'
import { RECORD_QUERY_DEFAULTS, RECORD_QUERY_ROOT } from '@/entities/memory'

/**
 * 앱 전역 단일 QueryClient. (app 레이어 소유)
 * connect-query가 이 위에 얹혀 GetUniverse·ListDormant를 선언적 쿼리로 돌린다(spec 16).
 * 전역 기본값은 보수적 안전망 — 쿼리별 정책(staleTime 5m·focus refetch 등)은
 * 각 쿼리 옵션이 오버라이드한다(spec 16 §캐싱 전략).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// 원본 일기(Record)는 불변(헌법 §1) → 영구 신선 + 30분 보관(값 정의는 entities/memory의
// RECORD_QUERY_DEFAULTS — 키와 정책이 한 곳). 이 캐시는 useQuery 없이 setQueryData로만
// 시드되므로(스피너 없는 재열람, spec 16) 기본값(gcTime 5m) 대신 prefix 단위로 박는다.
queryClient.setQueryDefaults([RECORD_QUERY_ROOT], RECORD_QUERY_DEFAULTS)
