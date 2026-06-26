import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { isDemoMode } from '@/shared/lib/demo'
import { settingsQueryOptions, applySettings, isEmotionColorComplete } from '@/entities/appearance'

/**
 * 감정색 게이트(spec 45). 인증·멤버십 통과 뒤, 개인 우주를 그리기 전에 `GetSettings`를 읽어 13개 mood
 * 감정색이 모두 확정돼 있는지 본다(최초 로그인 여부가 아니라 *서버 설정 내용*으로만 판정 — A2). 미완료면
 * `/emotion-colors?redirect=<원래경로>`로 보내고 `HomePage`는 마운트하지 않는다(A1). `SessionGate`→
 * `MembershipGate` 안쪽에 중첩되며(여기 도달 = authed·member), `/emotion-colors` 자신은 이 게이트 밖이다(A3).
 * 데모는 서버 DB가 없어 통과(기존 기본 팔레트로 체험 우주 렌더, A12). 로딩 중엔 우주를 그리지 않고 스플래시,
 * 실패 시 재시도(기본 팔레트로 먼저 띄웠다가 튕기는 깜빡임 금지, H).
 */
export function EmotionColorGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { data, isPending, isError, refetch } = useQuery(settingsQueryOptions())
  // 서버 설정을 store에 시드(렌더 부수효과 회피 — effect에서). 게이트 통과 전 children(HomePage)이
  // 마운트되지 않으므로 우주는 항상 확정된 감정색 위에서 그려진다(A10).
  useEffect(() => {
    if (data) applySettings(data)
  }, [data])

  if (isDemoMode()) return <>{children}</>

  if (isPending) {
    return (
      <div className="grid h-full w-full place-items-center">
        <p className="text-sm tracking-wide text-white/40">우주를 여는 중…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="grid h-full w-full place-items-center">
        <div className="text-center">
          <p className="text-sm text-white/50">설정을 불러오지 못했어요.</p>
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

  if (!isEmotionColorComplete(data)) {
    return <Navigate to="/emotion-colors" search={{ redirect: location.href }} replace />
  }

  return <>{children}</>
}
