// 없는 경로/비노출 표면 폴백 (17의 라우터 notFound + 34의 비관리자 /admin 위장).
// app(라우터 기본 폴백)과 pages(권한 거부를 404처럼 위장) 두 레이어가 쓰므로 shared/ui 소유.
import { GlassCard } from './GlassCard'
import { ghostButtonCls, primaryButtonCls } from './button-styles'

export function NotFoundScreen() {
  return (
    <div className="grid min-h-dvh w-full place-items-center bg-[#050510] px-6 text-white/90">
      <GlassCard className="flex w-96 max-w-[90vw] flex-col gap-4 p-8 text-center">
        <h1 className="text-lg font-light tracking-wide">이 좌표에는 아무것도 없어요</h1>
        <p className="text-sm text-white/45">주소가 바뀌었거나, 처음부터 없던 페이지예요.</p>
        <div className="flex justify-center gap-2">
          <a href="/" className={primaryButtonCls}>
            내 우주로
          </a>
          <a href="/landing" className={ghostButtonCls}>
            처음으로
          </a>
        </div>
      </GlassCard>
    </div>
  )
}
