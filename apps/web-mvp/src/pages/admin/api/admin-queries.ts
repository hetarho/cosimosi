// /admin 데이터 계층(spec 34): GetLLMConfig·GetAdminOverview 쿼리 + 뮤테이션 5종.
// 16의 connect-query 패턴(단일 transport·createQueryOptions) 미러 — 관리자 1인이
// 클릭할 때만 부르는 on-demand 데이터라 캐시 정책은 보수적으로 짧게 둔다.
// ⚠️ 키 입력값은 요청 본문으로만 나간다 — 캐시·스토어 어디에도 평문 키를 두지 않는다.
import {
  callUnaryMethod,
  createConnectQueryKey,
  createQueryOptions,
} from '@connectrpc/connect-query'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { Code, ConnectError } from '@connectrpc/connect'
import { AdminService, transport } from '@/shared/api'

// 콘솔 진입마다 신선하게(짧은 stale) — 다른 기기에서 바꾼 키 상태가 금방 보이게.
const ADMIN_STALE_MS = 30_000

/** GetLLMConfig 쿼리 옵션(공급자 5카드 + 활성 선택 + 암호화 준비 여부). */
export function llmConfigQueryOptions() {
  return queryOptions({
    ...createQueryOptions(AdminService.method.getLLMConfig, {}, { transport }),
    staleTime: ADMIN_STALE_MS,
  })
}

/** GetAdminOverview 쿼리 옵션(합계·잡 큐·30일 시리즈·토큰 사용). */
export function adminOverviewQueryOptions() {
  return queryOptions({
    ...createQueryOptions(AdminService.method.getAdminOverview, {}, { transport }),
    staleTime: ADMIN_STALE_MS,
  })
}

/**
 * ListAdminUsers 쿼리 옵션(spec 46) — user_id 검색 + keyset 페이지. 검색어/페이지 토큰마다 별도
 * 쿼리 키라 다음 페이지가 누적 캐시된다. page_size는 서버가 admin values로 클램프(미지정=0).
 */
export function adminUsersQueryOptions(input: { userIdQuery?: string; pageToken?: string }) {
  return queryOptions({
    ...createQueryOptions(
      AdminService.method.listAdminUsers,
      { userIdQuery: input.userIdQuery ?? '', pageSize: 0, pageToken: input.pageToken ?? '' },
      { transport },
    ),
    staleTime: ADMIN_STALE_MS,
  })
}

/** 비관리자 판별: 서버 게이트의 PermissionDenied → NotFound 위장 렌더(3.3). */
export function isPermissionDenied(error: unknown): boolean {
  return error instanceof ConnectError && error.code === Code.PermissionDenied
}

function llmConfigKey() {
  return createConnectQueryKey({
    schema: AdminService.method.getLLMConfig,
    cardinality: 'finite',
  })
}

// 입력(검색어/토큰) 없이 만든 부분 키 — invalidateQueries가 모든 ListAdminUsers 페이지를 prefix 매칭으로 무효화.
function adminUsersKey() {
  return createConnectQueryKey({
    schema: AdminService.method.listAdminUsers,
    cardinality: 'finite',
  })
}

/** 별가루 보정 지급(spec 46) — 성공 시 모든 사용자 목록 페이지 invalidate(잔액 즉시 갱신). */
export function useGrantUserStardust() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { targetUserId: string; amount: bigint }) =>
      callUnaryMethod(transport, AdminService.method.grantUserStardust, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminUsersKey() }),
  })
}

/** 설정 뮤테이션 공통: 성공 시 GetLLMConfig invalidate(카드 상태 재동기화). */
function useInvalidatingMutation<Input>(send: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: llmConfigKey() }),
  })
}

export function useSetProviderKey() {
  return useInvalidatingMutation((input: { provider: string; apiKey: string }) =>
    callUnaryMethod(transport, AdminService.method.setProviderKey, input),
  )
}

export function useDeleteProviderKey() {
  return useInvalidatingMutation((input: { provider: string }) =>
    callUnaryMethod(transport, AdminService.method.deleteProviderKey, input),
  )
}

export function useUpdateProviderModels() {
  return useInvalidatingMutation((input: { provider: string; models: string[] }) =>
    callUnaryMethod(transport, AdminService.method.updateProviderModels, input),
  )
}

export function useSetActiveLLM() {
  return useInvalidatingMutation((input: { provider: string; model: string }) =>
    callUnaryMethod(transport, AdminService.method.setActiveLLM, input),
  )
}

/** 키 검증 핑 — 설정을 바꾸지 않으므로 invalidate 없음. */
export function useTestProviderKey() {
  return useMutation({
    mutationFn: (input: { provider: string; model: string; apiKey: string }) =>
      callUnaryMethod(transport, AdminService.method.testProviderKey, input),
  })
}
