// 공명 정보 데이터 계층(spec 36): 별 상세 패널의 "○○의 우주와 공명 중". 별의 resonant 플래그(우주
// 스냅샷)가 true일 때만 호출해 상대 표시명·공개 슬러그를 가져온다(비공명 별엔 RPC를 아예 안 쏜다).
// gift 전용 전송(giftTransport — POST, 캐시 안 함).
import { callUnaryMethod } from '@connectrpc/connect-query'
import { queryOptions } from '@tanstack/react-query'
import { GiftService, giftTransport, type GetResonanceInfoResponse } from '@/shared/api'

const RESONANCE_STALE_MS = 60_000
const RESONANCE_GC_MS = 5 * 60_000

/** GetResonanceInfo 쿼리 옵션(memoryId별). enabled는 호출처가 resonant && !demo로 건다. */
export function resonanceInfoQueryOptions(memoryId: string) {
  return queryOptions({
    queryKey: ['resonance-info', memoryId],
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<GetResonanceInfoResponse> =>
      callUnaryMethod(giftTransport, GiftService.method.getResonanceInfo, { memoryId }, { signal }),
    staleTime: RESONANCE_STALE_MS,
    gcTime: RESONANCE_GC_MS,
  })
}
