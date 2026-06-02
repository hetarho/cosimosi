import type { ReactNode } from 'react'
import { useAuthStore } from '../model/auth-store'
import { SignInScreen } from './SignInScreen'

/**
 * 세션 게이트. /universe 보호 라우트의 element로 쓰인다.
 * loading → 스플래시(깜빡임 방지 1.7), anon → 사인인 화면(1.1), authed → 우주 셸 + 로그아웃(1.4).
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const signOut = useAuthStore((s) => s.signOut)

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
