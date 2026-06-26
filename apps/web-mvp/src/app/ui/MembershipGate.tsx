import type { ReactNode } from 'react'
import { Navigate, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { isDemoMode } from '@/shared/lib/demo'
import { membershipStatusQueryOptions } from '@/pages/invite'

/**
 * 멤버십 게이트(spec 41). 인증된 사용자가 코어 우주(`/`·`/gift/$token`)에 들어가기 전, 초대 코드를
 * redeem해 멤버가 됐는지 확인한다. 비멤버는 `/invite`로 보내 코드를 입력하게 한다. `SessionGate`
 * 안쪽에 중첩되므로(인증 먼저) 여기 도달하면 세션은 authed다. 서버 멤버십 인터셉터가 진짜 강제이고
 * 이건 그 UX 표면 — 게이트가 꺼져 있으면(`INVITE_GATE_ENABLED=false`) 서버가 전원 is_member=true를
 * 돌려주므로 항상 통과한다. `/invite`·`/admin`은 이 게이트로 감싸지 않는다.
 */
export function MembershipGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { data, isPending, isError, refetch } = useQuery(membershipStatusQueryOptions())

  // 데모 모드는 멤버십 검사 없이 통과(SessionGate가 이미 데모를 통과시킨다 — 더미 우주 둘러보기).
  if (isDemoMode()) return <>{children}</>

  if (isPending) {
    return (
      <div className="grid h-full w-full place-items-center">
        <p className="text-sm tracking-wide text-white/40">우주를 여는 중…</p>
      </div>
    )
  }

  // 멤버십 조회 실패: 코어로 들여보내지도(서버가 막음), 무작정 /invite로 튕기지도 않고 재시도를 제안한다.
  if (isError) {
    return (
      <div className="grid h-full w-full place-items-center">
        <div className="text-center">
          <p className="text-sm text-white/50">멤버십 확인에 실패했어요.</p>
          <button
            onClick={() => void refetch()}
            className="mt-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:text-white/90"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  // 비멤버 → 초대 코드 입력으로. 원래 가려던 경로(pathname+search)를 redirect로 실어 redeem 후 복귀.
  if (!data.isMember) return <Navigate to="/invite" search={{ redirect: location.href }} replace />

  return <>{children}</>
}
