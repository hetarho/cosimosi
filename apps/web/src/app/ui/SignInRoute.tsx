import { useEffect } from 'react'
import { useRouter, useSearch } from '@tanstack/react-router'
import { SessionContext } from './session-context'
import { SignInScreen } from './SignInScreen'

/**
 * `/sign-in` 라우트 콘텐츠(app 레이어 — SignInScreen이 app의 SessionContext/useAuthActions에
 * 의존해 pages로 내릴 수 없다, 불변 4). 미인증이면 사인인 폼을, 인증되면 redirect(없으면 `/`)로 보낸다.
 * `redirect`는 라우트 validateSearch에서 내부 경로만 통과시킨다(오픈 리다이렉트 방지).
 */
export function SignInRoute() {
  // 같은 세션 머신을 SessionGate와 공유 구독한다(머신 상태값 flat → 세 상태).
  const status = SessionContext.useSelector((s) => s.value as 'loading' | 'authed' | 'anon')
  const { redirect } = useSearch({ from: '/sign-in' })
  const router = useRouter()
  const target = redirect ?? '/'

  // 인증되면(이미 로그인한 채 직접 진입 A4, 또는 OTP 검증 성공 A3) 원래 경로로 복귀한다.
  // replace라 뒤로가기가 사인인으로 되돌아오지 않는다. Google OAuth는 풀페이지 라운드트립이라
  // redirect가 소실되고 `/`로 돌아오므로(session-context) 이 경로를 타지 않는다.
  useEffect(() => {
    if (status === 'authed') router.history.replace(target)
  }, [status, target, router])

  if (status === 'anon') return <SignInScreen />

  // loading + authed(복귀 직전 한 프레임) → 스플래시로 사인인 폼 깜빡임을 막는다.
  return (
    <div className="grid h-full w-full place-items-center">
      <p className="text-sm tracking-wide text-white/40">우주를 여는 중…</p>
    </div>
  )
}
