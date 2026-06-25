// 함께한 기억 — 공명 보내는 쪽 데이터 계층(spec 36): 별 보내기·취소 명령 + 보낸/받은 목록 쿼리.
// 인증 transport를 쓴다(양쪽이 cosimosi 사용자 — user_id = JWT sub). no three/React/DOM(헌법4) —
// 옵션 빌더 + 명령형 래퍼.
import { callUnaryMethod, createConnectQueryKey, createQueryOptions } from '@connectrpc/connect-query'
import { queryOptions } from '@tanstack/react-query'
import { GiftService, giftTransport, type ListStarGiftsResponse, type SendStarGiftResponse } from '@/shared/api'

// 목록은 보내기·취소·수락에 따라 바뀌므로 짧은 stale + 변경 시 무효화로 신선도를 유지한다.
const GIFTS_STALE_MS = 30_000
const GIFTS_GC_MS = 5 * 60_000

function buildListStarGiftsQueryOptions() {
  const base = createQueryOptions(GiftService.method.listStarGifts, {}, { transport: giftTransport })
  return queryOptions({
    ...base,
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<ListStarGiftsResponse> =>
      callUnaryMethod(giftTransport, GiftService.method.listStarGifts, {}, { signal }),
    staleTime: GIFTS_STALE_MS,
    gcTime: GIFTS_GC_MS,
    refetchOnWindowFocus: true,
    // 목록 시트를 다시 열 때마다 서버에서 새로 받는다 — 상대가 그 사이 수락/거절해 상태가 바뀌면
    // (이 클라가 무효화 못 한 변경) stale '대기 중'에 취소를 눌러 서버 에러가 나는 일을 막는다.
    refetchOnMount: 'always',
  })
}

let listOptionsCache: ReturnType<typeof buildListStarGiftsQueryOptions> | undefined

/** ListStarGifts 쿼리 옵션 — 보낸/받은 목록 시트가 마운트될 때 시드. */
export function listStarGiftsQueryOptions() {
  return (listOptionsCache ??= buildListStarGiftsQueryOptions())
}

/** ListStarGifts 부분 키(invalidate 전용) — 보내기·취소 성공 시 목록을 다시 불러온다. */
export function listStarGiftsInvalidateKey() {
  return createConnectQueryKey({ schema: GiftService.method.listStarGifts, cardinality: 'finite' })
}

/** 별 보내기 — 토큰 URL을 발급한다. 호출 전에 UI가 "받는 사람이 이 조각 글을 읽게 된다"는
 *  고지를 띄운다(acceptance 1.1; opt-in 명시는 화면의 책임). */
export function sendStarGift(memoryId: string, message: string): Promise<SendStarGiftResponse> {
  return callUnaryMethod(giftTransport, GiftService.method.sendStarGift, { memoryId, message })
}

/** 보낸 별 취소(pending에 한함) — 수신 링크가 즉시 무효가 된다(acceptance 1.4). */
export function cancelStarGift(giftId: string): Promise<void> {
  return callUnaryMethod(giftTransport, GiftService.method.cancelStarGift, { giftId }).then(() => undefined)
}
