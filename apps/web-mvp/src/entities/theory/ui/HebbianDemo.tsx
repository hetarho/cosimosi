// 헵 강화 인터랙티브 데모 — 랜딩 HebbianCard의 시연 원본을 entity로 이식(spec 19).
// "함께 떠올리기"를 누를 때마다 실제 규칙(+0.05·상한 1.0)으로 단조 강화된다.
import { useState } from 'react'
import { MOOD, VALUES } from '@/shared/config'
import { useAppearance } from '@/entities/appearance/@x/theory'
import { VizStar } from '@/entities/star/@x/theory'
import { VizSynapse } from '@/entities/synapse/@x/theory'

const TEAL = MOOD.teal

// 실제 우주의 규칙 그대로(spec 11). DELTA는 features/recall CO_RECALL_DELTA(0.05)의
// 거울값 — entity는 features를 import할 수 없어(FSD 단방향) 값으로 둔다. 바뀌면 함께.
const DELTA = VALUES.recall.coRecallDelta
const BASE = 0.3 // 이미 옅게 이어져 있는 두 기억에서 시작

export function HebbianDemo() {
  const concept = useAppearance((s) => s.object)
  const [count, setCount] = useState(0)
  const w = Math.min(1, BASE + count * DELTA)
  const maxed = w >= 1

  return (
    <div className="flex flex-col gap-4">
      <span className="text-sm text-mood-teal/90">함께 떠올릴수록, 둘을 잇는 선이 굵어져요</span>

      <div className="rounded-2xl border border-white/10 bg-space-900/40 p-4">
        <svg viewBox="0 0 120 64" className="h-32 w-full" role="img" aria-label="두 기억을 잇는 시냅스">
          <VizSynapse x1={28} y1={32} x2={92} y2={32} color={TEAL} strength={w} arc={0.16} active={count > 0} concept={concept} />
          <VizStar cx={28} cy={32} r={11} color={TEAL} concept={concept} seed={101} brightness={0.5 + w * 0.5} active={count > 0} />
          <VizStar cx={92} cy={32} r={11} color={TEAL} concept={concept} seed={202} brightness={0.5 + w * 0.5} active={count > 0} />
        </svg>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCount((c) => c + 1)}
            disabled={maxed}
            className="rounded-full border border-mood-teal/40 bg-mood-teal/10 px-4 py-1.5 text-xs text-mood-teal transition-colors hover:bg-mood-teal/20 disabled:cursor-default disabled:opacity-50"
          >
            {maxed ? '가장 또렷해요' : '두 별, 함께 떠올리기 (+0.05)'}
          </button>
          <span className="text-xs tabular-nums text-white/55">
            연결 강도 {w.toFixed(2)}
            {count > 0 && !maxed && <span className="text-mood-teal/80"> · ×{count}</span>}
          </span>
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={() => setCount(0)}
            className="mt-1 text-[11px] text-white/35 transition hover:text-white/60"
          >
            처음으로
          </button>
        )}
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        실제 우주와 같은 규칙이에요 — 두 기억을 잇따라 회상할 때마다 +0.05,
        1.0에서 멈춰요. 옅어지는 쪽은 재공고화(plan 23)가 가져와요.
      </p>
    </div>
  )
}
