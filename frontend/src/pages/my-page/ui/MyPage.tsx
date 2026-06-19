// 최소 마이페이지(change 09, A?/범위) — 우주 셸 사이드바에서 가는 보호 계정 표면. 이번 범위는
// 현재 세션 식별 표시 + 로그아웃까지다. 프로필 편집·탈퇴·알림 설정 같은 세부 계정 기능은 후속 범위.
// 로그아웃은 사이드바와 같은 signOut 경로를 재사용한다(앱이 onSignOut을 내려준다 — pages는
// session-context를 직접 import하지 않음, FSD).
import { useNavigate } from '@tanstack/react-router'

export interface MyPageProps {
  /** 현재 세션 이메일(없으면 미표시). */
  email?: string | null
  /** 실로그아웃(앱 session-context.signOut). */
  onSignOut: () => void
}

export function MyPage({ email, onSignOut }: MyPageProps) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-white/90">마이페이지</h1>
        <button
          type="button"
          onClick={() => void navigate({ to: '/' })}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:text-white/90"
        >
          우주로
        </button>
      </header>

      <section className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <span className="text-xs text-white/45">계정</span>
        <span className="ph-no-capture text-sm text-white/85">{email ?? '로그인된 사용자'}</span>
      </section>

      <button
        type="button"
        onClick={onSignOut}
        className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        로그아웃
      </button>

      <p className="text-xs leading-relaxed text-white/35">
        프로필 편집·알림·탈퇴 같은 계정 설정은 곧 추가될 예정이에요.
      </p>
    </div>
  )
}
