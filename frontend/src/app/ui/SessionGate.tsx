import type { ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from '@tanstack/react-router'
import { exitDemoMode, isDemoMode, resetDemo } from '@/shared/lib/demo'
import { SessionContext, useAuthActions } from './session-context'

/**
 * 세션 게이트. 보호 라우트(`/` 우주·`/admin`·`/gift/$token`)의 element로 쓰인다.
 * loading → 스플래시(깜빡임 방지 1.7), anon → `/sign-in`으로 리다이렉트(1.1), authed → 셸 + 로그아웃(1.4).
 * 미인증은 인라인 사인인이 아니라 `/sign-in?redirect=<원래 경로>`로 보내고, 인증 후 그 경로로 복귀한다.
 * 체험("demo") 모드면 로그인 없이 통과시키고, 로그아웃 대신 "체험 종료" 핀을 띄운다 —
 * 같은 우주 셸을 더미데이터로 그대로 둘러보게 한다.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  // 머신 상태값(flat) → 'loading' | 'authed' | 'anon'. 그 슬라이스만 구독(전환마다 리렌더 X).
  const status = SessionContext.useSelector((s) => s.value as 'loading' | 'authed' | 'anon')
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()

  if (isDemoMode()) {
    const leave = () => {
      exitDemoMode()
      resetDemo() // 추가했던 더미 별 비우기 → 다음 진입은 깨끗하게
      // `/`는 이제 보호 라우트(우주)라 미인증이면 사인인으로 튕긴다 — 마케팅 랜딩으로 보낸다.
      void navigate({ to: '/landing' })
    }
    return (
      <>
        {children}
        <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 z-50 flex items-center gap-2">
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-200/90 backdrop-blur">
            체험 모드 · 새로고침하면 초기화돼요
          </span>
          <button
            onClick={leave}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 backdrop-blur transition hover:text-white/80"
          >
            체험 종료
          </button>
        </div>
      </>
    )
  }

  if (status === 'loading') {
    return (
      <div className="grid h-full w-full place-items-center">
        <p className="text-sm tracking-wide text-white/40">우주를 여는 중…</p>
      </div>
    )
  }

  // 미인증 → 사인인 라우트로. 원래 가려던 경로(pathname+search)를 redirect로 실어 인증 후 복귀시킨다.
  if (status === 'anon')
    return <Navigate to="/sign-in" search={{ redirect: location.href }} replace />

  return (
    <>
      {children}
      <button
        onClick={() => void signOut()}
        className="fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 z-50 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 backdrop-blur transition hover:text-white/80"
      >
        로그아웃
      </button>
    </>
  )
}
