import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { exitDemoMode, isDemoMode, resetDemo } from '@/shared/demo'
import { useAuthStore } from '../model/auth-store'
import { SignInScreen } from './SignInScreen'

/**
 * 세션 게이트. /universe 보호 라우트의 element로 쓰인다.
 * loading → 스플래시(깜빡임 방지 1.7), anon → 사인인 화면(1.1), authed → 우주 셸 + 로그아웃(1.4).
 * 체험("demo") 모드면 로그인 없이 통과시키고, 로그아웃 대신 "체험 종료" 핀을 띄운다 —
 * 같은 우주 셸을 더미데이터로 그대로 둘러보게 한다.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()

  if (isDemoMode()) {
    const leave = () => {
      exitDemoMode()
      resetDemo() // 추가했던 더미 별 비우기 → 다음 진입은 깨끗하게
      void navigate({ to: '/' })
    }
    return (
      <>
        {children}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-200/90 backdrop-blur">
            체험 모드 · 새로고침하면 초기화돼요
          </span>
          <button
            onClick={leave}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 backdrop-blur transition hover:text-white/80"
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

  if (status === 'anon') return <SignInScreen />

  return (
    <>
      {children}
      <button
        onClick={() => void signOut()}
        className="fixed top-4 right-4 z-50 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 backdrop-blur transition hover:text-white/80"
      >
        로그아웃
      </button>
    </>
  )
}
