// 에러·notFound 폴백 화면 (spec 17) — 전역 바운더리와 라우터 폴백이 쓰는 풀스크린 카드.
// 흰 화면 금지: 어떤 경로로 깨져도 사용자는 설명 + 다음 행동(새로고침/재시도/홈)을 받는다.
// 에러 후 라우터 상태를 신뢰할 수 없으므로 이동은 <Link>가 아니라 평범한 <a>(전체 리로드).
import type { ErrorComponentProps } from '@tanstack/react-router'
import { errorMessage } from '@/shared/lib'
import { GlassCard, ghostButtonCls, primaryButtonCls } from '@/shared/ui'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh w-full place-items-center bg-[#050510] px-6 text-white/90">
      <GlassCard className="flex w-96 max-w-[90vw] flex-col gap-4 p-8 text-center">
        {children}
      </GlassCard>
    </div>
  )
}

/** 전역 바운더리 폴백 — 여기까지 왔다는 건 라우터 폴백조차 못 그린 상태라 새로고침이 답.
 *  Sentry FallbackRender 시그니처와 구조 호환(추가 prop은 무시). */
export function GlobalErrorScreen({ error }: { error: unknown }) {
  return (
    <Shell>
      <h1 className="text-lg font-light tracking-wide">문제가 생겼어요</h1>
      <p className="text-sm text-white/45">
        화면을 그리는 중에 오류가 났어요. 새로고침하면 대부분 해결돼요.
      </p>
      <p className="text-xs break-all text-white/30">{errorMessage(error)}</p>
      <button type="button" className={primaryButtonCls} onClick={() => window.location.reload()}>
        새로고침
      </button>
    </Shell>
  )
}

/** 라우트 로드/렌더 실패 폴백 (router.defaultErrorComponent). */
export function RouteErrorScreen({ error, reset }: ErrorComponentProps) {
  return (
    <Shell>
      <h1 className="text-lg font-light tracking-wide">이 화면을 불러오지 못했어요</h1>
      <p className="text-xs break-all text-white/30">{errorMessage(error)}</p>
      <div className="flex justify-center gap-2">
        <button type="button" className={primaryButtonCls} onClick={() => reset()}>
          다시 시도
        </button>
        <a href="/landing" className={ghostButtonCls}>
          처음으로
        </a>
      </div>
    </Shell>
  )
}

/** 없는 경로 폴백 (router.defaultNotFoundComponent, 2.3). 34에서 pages 레이어도
 *  쓰게 되어 shared/ui로 승격 — 여기서는 라우터 배선용 재export만 유지한다. */
export { NotFoundScreen } from '@/shared/ui'
