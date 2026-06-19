import { useNavigate } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { startDemoSession } from '@/shared/lib/demo'
import { cn } from '@/shared/lib'

/**
 * "체험 우주에서 해보기"(spec 19) — 랜딩 카드를 체험 우주로 잇는다. HeroSection의
 * tryDemo()와 같은 `/` 진입 경로다(plan 47 이후 데모는 온보딩부터 시작 — 페르소나/모드 선택).
 * `?sim=<id>`는 그 카드의 이론 식별자로 함께 싣되, 자유모드 셸에서는 더 이상 이론 모달을 자동으로
 * 열지 않는다(기억 실험실/이론 표면은 후속 튜토리얼 plan 소관).
 */
export function TryInUniverse({
  sim,
  label = '체험 우주에서 해보기',
  className,
}: {
  /** widgets/demo-sim 레지스트리의 SimEntry id. */
  sim: string
  label?: string
  className?: string
}) {
  const navigate = useNavigate()
  const go = () => {
    startDemoSession()
    void navigate({ to: '/', search: { sim } })
  }
  return (
    <button
      type="button"
      onClick={go}
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs text-white/75 transition hover:border-white/35 hover:bg-white/10 hover:text-white',
        className,
      )}
    >
      {label}
      <ArrowRight size={13} aria-hidden />
    </button>
  )
}
