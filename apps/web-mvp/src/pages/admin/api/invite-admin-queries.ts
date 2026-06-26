// /admin 초대 코드 탭 데이터 계층(spec 41): 발행 목록 쿼리 + 발행/취소 뮤테이션. admin-queries의
// connect-query 패턴 미러. InviteAdminService는 서버 admin allowlist 게이트 뒤에 있다(34와 동일).
// 게이트가 제거되면 이 파일·InviteCodesTab을 통째로 지운다(관심사 분리).
import {
  callUnaryMethod,
  createConnectQueryKey,
  createQueryOptions,
} from '@connectrpc/connect-query'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { InviteAdminService, transport } from '@/shared/api'

const INVITE_STALE_MS = 15_000

/** ListInviteCodes 쿼리 옵션(최신 발행이 위로). */
export function inviteCodesQueryOptions() {
  return queryOptions({
    ...createQueryOptions(InviteAdminService.method.listInviteCodes, {}, { transport }),
    staleTime: INVITE_STALE_MS,
  })
}

function inviteCodesKey() {
  return createConnectQueryKey({
    schema: InviteAdminService.method.listInviteCodes,
    cardinality: 'finite',
  })
}

/** 발행 입력 — 직교 모델: maxUses(생략=무제한) · ttlSeconds(생략=만료없음). */
export interface IssueInput {
  label: string
  maxUses?: number
  ttlSeconds?: bigint
}

export function useIssueInviteCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: IssueInput) =>
      callUnaryMethod(transport, InviteAdminService.method.issueInviteCode, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inviteCodesKey() }),
  })
}

export function useRevokeInviteCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      callUnaryMethod(transport, InviteAdminService.method.revokeInviteCode, { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inviteCodesKey() }),
  })
}
