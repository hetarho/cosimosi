// 우주 공개 설정 데이터 계층(spec 35): 인증 ShareService 쿼리(GetShareSettings) + 변경 호출
// (UpdateShareSettings·RotateShareSlug). 인증 transport를 쓴다(소유자 전용 — user_id = JWT sub).
// no three/React/DOM(헌법4) — 옵션 빌더 + 명령형 래퍼.
import { callUnaryMethod, createQueryOptions } from '@connectrpc/connect-query'
import { queryOptions } from '@tanstack/react-query'
import {
  ShareService,
  transport,
  type GetShareSettingsResponse,
  type RotateShareSlugResponse,
  type UpdateShareSettingsResponse,
} from '@/shared/api'

// 공유 설정은 드물게 바뀐다 — focus refetch는 끄고(쓰기가 store/cache를 직접 갱신), 진입 1회 시드면
// 충분. universe/settings 쿼리와 같은 정책.
const SHARE_STALE_MS = 60_000
const SHARE_GC_MS = 5 * 60_000

function buildShareSettingsQueryOptions() {
  const base = createQueryOptions(ShareService.method.getShareSettings, {}, { transport })
  return queryOptions({
    ...base,
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<GetShareSettingsResponse> =>
      callUnaryMethod(transport, ShareService.method.getShareSettings, {}, { signal }),
    staleTime: SHARE_STALE_MS,
    gcTime: SHARE_GC_MS,
    refetchOnWindowFocus: false,
  })
}

let shareOptionsCache: ReturnType<typeof buildShareSettingsQueryOptions> | undefined

/** GetShareSettings 쿼리 옵션 — 공유 모달이 마운트될 때 1회 시드. queryKey는 변경 성공 시
 *  setQueryData로 캐시를 직접 갱신하는 데 쓴다(refetch 왕복 없이 즉시 반영). */
export function shareSettingsQueryOptions() {
  return (shareOptionsCache ??= buildShareSettingsQueryOptions())
}

/** 공유 on/off + 표시명 갱신(최초 켜기에 슬러그 생성). */
export function updateShareSettings(
  enabled: boolean,
  displayName: string,
): Promise<UpdateShareSettingsResponse> {
  return callUnaryMethod(transport, ShareService.method.updateShareSettings, { enabled, displayName })
}

/** 슬러그 회전 — 이전 링크는 즉시 무효가 된다. */
export function rotateShareSlug(): Promise<RotateShareSlugResponse> {
  return callUnaryMethod(transport, ShareService.method.rotateShareSlug, {})
}
