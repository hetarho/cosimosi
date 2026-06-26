// 받은 링크(/gift/:token) 데이터 계층(spec 36): GetStarGift 읽기 + 수락(재작성)·거절 명령.
// gift 전용 전송(giftTransport — POST, 캐시 안 함)을 쓴다: gift 상태는 바뀌므로 매번 서버가 권위.
import { callUnaryMethod } from '@connectrpc/connect-query'
import { queryOptions } from '@tanstack/react-query'
import {
  GiftService,
  giftTransport,
  Mood,
  type AcceptStarGiftResponse,
  type GetStarGiftResponse,
} from '@/shared/api'

/** GetStarGift 쿼리 옵션(token별). 상태가 바뀌므로 캐시하지 않는다(staleTime 0·gcTime 0·
 *  refetchOnMount 'always'); NotFound/만료는 영구 상태라 재시도하지 않는다. */
export function getStarGiftQueryOptions(token: string) {
  return queryOptions({
    queryKey: ['star-gift', token],
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<GetStarGiftResponse> =>
      callUnaryMethod(giftTransport, GiftService.method.getStarGift, { token }, { signal }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
}

/** 수락 = 재작성. 한 트랜잭션으로 내 record + 단일 별 + 공명이 태어난다(서버). 성공 시 새 별 id를 돌려준다. */
export function acceptStarGift(
  token: string,
  text: string,
  mood: Mood,
  intensity: number,
  valence: number,
): Promise<AcceptStarGiftResponse> {
  return callUnaryMethod(giftTransport, GiftService.method.acceptStarGift, {
    token,
    text,
    mood,
    intensity,
    valence,
  })
}

/** 거절(사유 무 — 상태만). */
export function declineStarGift(token: string): Promise<void> {
  return callUnaryMethod(giftTransport, GiftService.method.declineStarGift, { token }).then(() => undefined)
}
