import { errorMessage } from '@/shared/lib'
import { RendererUnavailableError } from '@/shared/lib/r3f'
import { primaryButtonCls } from '@/shared/ui'

/** 우주 영역 풀오버레이 에러 카드 chrome — 쿼리 실패(16)와 캔버스 크래시(17)가 공유. */
export function UniverseErrorCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <div className="flex w-80 max-w-[85vw] flex-col gap-3 rounded-xl border border-white/10 bg-black/60 p-5 text-center backdrop-blur">
        {children}
      </div>
    </div>
  )
}

/** 캔버스 전용 폴백(17, 2.1/2.2) — Sentry FallbackRender 시그니처의 모듈 레벨 컴포넌트.
 *  (인라인 화살표를 fallback으로 주면 Sentry가 함수를 element type으로 써서 HomePage
 *  리렌더마다 폴백이 리마운트된다 — 재시도 버튼 포커스 유실.) 원인 구분: 렌더러 자체가
 *  불가한 기기(WebGPU·WebGL2 모두 실패 — 재시도 무의미, 안내만)와 일반 렌더 크래시
 *  (다시 시도 = 캔버스 리마운트). 어느 쪽이든 HUD(작성 폼)는 바운더리 밖이라 살아 있다. */
export function CanvasErrorFallback({ error, resetError }: { error: unknown; resetError: () => void }) {
  const unavailable = error instanceof RendererUnavailableError
  return (
    <UniverseErrorCard>
      {unavailable ? (
        <>
          <p className="text-sm text-white/85">이 브라우저/기기에서는 우주를 그릴 수 없어요.</p>
          <p className="text-xs text-white/45">
            최신 Chrome·Edge·Safari로 열거나, 그래픽 가속이 켜져 있는지 확인해 주세요. 일기
            작성은 그대로 할 수 있어요 — 별은 안전하게 기록돼요.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-white/85">우주를 불러오지 못했어요.</p>
          <p className="text-xs break-all text-white/40">{errorMessage(error)}</p>
          <button type="button" onClick={resetError} className={primaryButtonCls}>
            다시 시도
          </button>
        </>
      )}
    </UniverseErrorCard>
  )
}
