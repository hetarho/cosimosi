import { Navigate, useLocation, useSearch } from '@tanstack/react-router'
import { SessionContext } from './session-context'
import { InvitePage } from '@/pages/invite'

/**
 * `/invite` 라우트 콘텐츠(app 레이어 — InvitePage에 세션 상태를 내려줘야 하는데 pages는 SessionContext를
 * import할 수 없다, 불변 4). change 05: `code`가 있으면 **미인증도 초대장 화면을 먼저** 본다(사인인으로 안
 * 튕김, A3). 코드 없는 미인증은 기존대로 사인인으로(미인증은 redeem 불가). 인증이면 InvitePage가 멤버 통과/
 * 자동 redeem/수동 입력을 처리한다. redeem 표면이라 `MembershipGate` 밖이다(비멤버가 코드를 쓰는 유일한 곳).
 */
export function InviteRoute() {
  const status = SessionContext.useSelector((s) => s.value as 'loading' | 'authed' | 'anon')
  const { code, redirect } = useSearch({ from: '/invite' })
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="grid h-full w-full place-items-center">
        <p className="text-sm tracking-wide text-white/40">우주를 여는 중…</p>
      </div>
    )
  }

  // 미인증 + 코드 없음 → 사인인으로(redeem은 인증 호출). 미인증 + 코드 → InvitePage가 초대장 화면을 보여준다.
  if (status === 'anon' && !code) {
    return <Navigate to="/sign-in" search={{ redirect: location.href }} replace />
  }

  return <InvitePage authed={status === 'authed'} code={code} redirect={redirect} />
}
