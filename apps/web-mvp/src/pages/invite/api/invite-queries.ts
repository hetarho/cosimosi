// /invite 데이터 계층(spec 41): 멤버십 상태 쿼리 + 코드 redeem 뮤테이션 + 비소비 검증 호출.
// admin-queries(16 connect-query 패턴) 미러 — 단일 transport·createQueryOptions. 게이트가 제거되면
// 이 파일과 pages/invite 슬라이스를 통째로 지운다.
import {
  callUnaryMethod,
  createConnectQueryKey,
  createQueryOptions,
} from '@connectrpc/connect-query'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { InviteService, transport } from '@/shared/api'

const MEMBERSHIP_STALE_MS = 30_000

/** GetMembershipStatus 쿼리 옵션 — MembershipGate가 구독해 비멤버를 /invite로 보낸다. */
export function membershipStatusQueryOptions() {
  return queryOptions({
    ...createQueryOptions(InviteService.method.getMembershipStatus, {}, { transport }),
    staleTime: MEMBERSHIP_STALE_MS,
  })
}

/** 멤버십 쿼리 키 — redeem 성공 시 invalidate해 게이트가 즉시 통과로 재평가되게 한다. */
function membershipStatusKey() {
  return createConnectQueryKey({
    schema: InviteService.method.getMembershipStatus,
    cardinality: 'finite',
  })
}

/**
 * 코드 redeem(원자 소비+멤버십). 성공 시 멤버십 쿼리를 **제거**한다(invalidate가 아니라 remove).
 * MembershipGate는 /invite엔 마운트돼 있지 않아 invalidate해도 곧장 refetch되지 않고, 캐시엔
 * redirect 당시의 `{isMember:false}`가 남는다 — 그대로 두면 redeem 후 `/`로 가는 순간 게이트가 그 stale
 * false를 먼저 렌더해 다시 /invite로 튕긴다(codex 지적). remove하면 `/` 진입 시 데이터 없음 → 스플래시 →
 * 신선 fetch(이제 true) → 통과. 캐시에 메시지 객체를 수기로 넣지 않아 타입도 깔끔하다.
 */
export function useRedeemInviteCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      callUnaryMethod(transport, InviteService.method.redeemInviteCode, { code }),
    onSuccess: (res) => {
      if (res.ok) queryClient.removeQueries({ queryKey: membershipStatusKey() })
    },
  })
}

/** 비소비 인라인 검증 — 입력이 다 찼을 때 호출해 사유별 사전 피드백을 준다(권위는 redeem). */
export function validateInviteCode(code: string) {
  return callUnaryMethod(transport, InviteService.method.validateInviteCode, { code })
}
