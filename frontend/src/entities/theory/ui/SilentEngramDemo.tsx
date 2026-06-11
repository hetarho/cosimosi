// 시간 감쇠·침묵 엔그램 인터랙티브 데모 — 랜딩 SilentEngramCard의 시연 원본을 entity로
// 이식(spec 19). 실제 망각 모델(A_MIN=5%·반감기 30일, entities/memory 정전 상수)이 그대로
// 돈다. 관련성 감쇠(고립 별이 더 빨리)는 plan 26 비전이라 오른쪽 별로 따로 표기.
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { MOOD } from '@/shared/config'
import { A_MIN, HALF_LIFE_DAYS } from '@/entities/memory/@x/theory'
import { useAppearance } from '@/entities/appearance/@x/theory'
import { VizStar } from '@/entities/star/@x/theory'

const CORAL = MOOD.coral

/** plan 26 비전의 예시: 홀로 떨어진 별은 더 빨리(반감기 ~10일) 어두워진다. */
const ISOLATED_HALF_LIFE = 10
const MAX_DAYS = 180

const decay = (days: number, halfLife: number) =>
  Math.max(A_MIN, Math.exp((-Math.LN2 / halfLife) * days))

export function SilentEngramDemo() {
  const concept = useAppearance((s) => s.object)
  const [days, setDays] = useState(90)

  const current = decay(days, HALF_LIFE_DAYS) // 지금 우주의 모든 별
  const isolated = decay(days, ISOLATED_HALF_LIFE) // plan 26 비전(고립 별)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-around gap-4 rounded-2xl border border-white/10 bg-space-900/40 p-5">
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden>
            <VizStar cx={50} cy={50} r={28} color={CORAL} concept={concept} seed={107} brightness={current} />
          </svg>
          <span className="text-xs text-white/70">지금의 우주 · 반감기 30일</span>
          <span className="text-[11px] tabular-nums text-mood-coral/80">밝기 {Math.round(current * 100)}%</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden>
            <VizStar cx={50} cy={50} r={28} color={CORAL} concept={concept} seed={233} brightness={isolated} />
          </svg>
          <span className="text-xs text-white/50">홀로 떨어진 별 · 🚧 plan 26</span>
          <span className="text-[11px] tabular-nums text-mood-coral/60">밝기 {Math.round(isolated * 100)}%</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>회상하지 않은 채 흐른 시간</span>
          <span className="tabular-nums">{days === 0 ? '방금 회상했어요' : `+${days}일`}</span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_DAYS}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="회상하지 않은 채 흐른 시간"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-mood-coral"
        />
        <button
          type="button"
          onClick={() => setDays(0)}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-full border border-mood-coral/40 bg-mood-coral/10 px-4 py-1.5 text-xs text-mood-coral transition-colors hover:bg-mood-coral/20"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          다시 비추기 — 재점화
        </button>
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        실제 우주의 수식 그대로예요 — 반감기 30일로 어두워지되, 아무리 오래 둬도 빛은{' '}
        {Math.round(A_MIN * 100)}% 아래로 꺼지지 않아요. 원본은 그대로 남고, 회상 한 번이면 별은
        다시 깨어나요. 연결·감정이 망각 속도를 바꾸는 건 plan 26에서 와요.
      </p>
    </div>
  )
}
