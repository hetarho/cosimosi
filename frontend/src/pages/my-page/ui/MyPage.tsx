// 최소 마이페이지(change 09, A?/범위) — 우주 셸 사이드바에서 가는 보호 계정 표면. 이번 범위는
// 현재 세션 식별 표시 + 로그아웃까지다. 프로필 편집·탈퇴·알림 설정 같은 세부 계정 기능은 후속 범위.
// 로그아웃은 사이드바와 같은 signOut 경로를 재사용한다(앱이 onSignOut을 내려준다 — pages는
// session-context를 직접 import하지 않음, FSD).
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { EmotionColorEditor } from '@/features/pick-emotion-colors'

export interface MyPageProps {
  /** 현재 세션 이메일(없으면 미표시). */
  email?: string | null
  /** 실로그아웃(앱 session-context.signOut). */
  onSignOut: () => void
}

export function MyPage({ email, onSignOut }: MyPageProps) {
  const navigate = useNavigate()
  const [emotionSaved, setEmotionSaved] = useState(false)
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

      {/* 감정 색 — 13감정 색을 편집·저장(change 10). 우주의 꾸미기 패널은 스킨 4축만 다루고, 감정 색 편집은
          여기로 모인다. 최초 온보딩 게이트(/emotion-colors)는 그대로 동작하고 같은 EmotionColorEditor를 쓴다. */}
      <section className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-white/45">감정 색</span>
          <p className="text-xs leading-relaxed text-white/40">
            13가지 감정에 내 색을 입혀요. 별과 우주의 결이 이 색에서 태어나요.
          </p>
        </div>
        <EmotionColorEditor onSaved={() => setEmotionSaved(true)} saveLabel="감정 색 저장" />
        {emotionSaved && (
          <p className="text-xs text-emerald-300/80" role="status">
            감정 색을 저장했어요.
          </p>
        )}
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
