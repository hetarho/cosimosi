import { cn } from '@/shared/lib'

/**
 * 이론 카드 상태 배지(spec 19) — 카드가 보여주는 뇌과학 이론이 지금 우주에서 동작하는지
 * (✅), 의도된 비전인지(🚧 + plan NN)를 드러낸다. 랜딩은 최종 비전 showcase이므로
 * 계획 카드도 그대로 두되, 무엇이 이미 참인지 방문자가 구분할 수 있어야 한다.
 */
export function TheoryBadge({
  status,
  plan,
  className,
}: {
  status: 'done' | 'planned'
  /** 근거 plan 번호 표기(예: '11', '08·11', 'v1+'). */
  plan?: string
  className?: string
}) {
  const done = status === 'done'
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] leading-none',
        done
          ? 'border-mood-teal/30 bg-mood-teal/10 text-mood-teal/90'
          : 'border-mood-amber/30 bg-mood-amber/10 text-mood-amber/90',
        className,
      )}
    >
      {done ? `✅ 지금 우주에서 동작해요${plan ? ` · plan ${plan}` : ''}` : `🚧 계획된 비전${plan ? ` · plan ${plan}` : ''}`}
    </span>
  )
}
