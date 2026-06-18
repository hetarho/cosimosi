import { useNavigate } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { enterDemoMode } from '@/shared/lib/demo'
import { cn } from '@/shared/lib'

/**
 * "체험 우주에서 해보기"(spec 19) — 랜딩 카드를 체험 우주로 잇는다. HeroSection의
 * tryDemo()와 같은 `/` 진입 경로에, 그 카드의 이론에 해당하는 `?sim=<id>`를 더해
 * 기억 실험실/이론 모달이 그 이론을 펼친 채 맞이하게 한다.
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
    enterDemoMode()
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
