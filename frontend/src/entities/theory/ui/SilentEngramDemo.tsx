// 망각 인터랙티브 데모 — 랜딩 SilentEngramCard의 시연 본체이자 데모 모달의 'dormant' 카드(spec 19에서
// 공유). 실제 망각 모델(밝기=자기-거리, spec 38 change 19)이 그대로 돈다: 연결 많고·자주 떠올리고·감정
// 강한 별은 천천히 멀어지며 밝게 머물고, 고립된 옅은 별은 더 빨리 멀어져 어두워지되 둘 다 A_MIN(5%)
// 바닥 아래로는 꺼지지 않는다(헌법2). 밝기는 거리를 통해서만 정해진다 — 연결·회상·감정이 거리를 늦춘다.
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { MOOD } from '@/shared/config'
import { A_MIN, starGlow } from '@/entities/memory/@x/theory'
import { useAppearance } from '@/entities/appearance/@x/theory'
import { VizStar } from '@/entities/star/@x/theory'

const CORAL = MOOD.coral
const MAX_DAYS = 180
const DAY_MS = 86_400_000
const NOW = 1_700_000_000_000

// 두 별의 거리(반지름) 입력(SilentEngramCard 보정 앵커: 고립이 연결보다 빠르게 멀어져 어두워진다).
//  - 연결·감정 별: degree↑·Σweight↑·회상↑·감정 강도↑ → τ가 길어 천천히 멀어진다(가깝고 밝게 머묾).
//  - 고립·옅은 별: 무연결·드문 회상·옅은 감정 → 거의 순수 시간 감쇠로 빠르게 외곽으로.
const CONNECTED = { degreeNorm: 1.2, weightedDegreeNorm: 1.2, recallCount: 4, intensity: 0.75 }
const ISOLATED = { degreeNorm: 0, weightedDegreeNorm: 0, recallCount: 1, intensity: 0.15 }

const brightnessAt = (days: number, s: typeof CONNECTED) =>
  starGlow(s.recallCount, s.intensity, NOW - days * DAY_MS, NOW, s.degreeNorm, s.weightedDegreeNorm)

export function SilentEngramDemo() {
  const concept = useAppearance((s) => s.object)
  const [days, setDays] = useState(90)

  const connected = brightnessAt(days, CONNECTED)
  const isolated = brightnessAt(days, ISOLATED)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-around gap-4 rounded-2xl border border-white/10 bg-space-900/40 p-5">
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden>
            <VizStar cx={50} cy={50} r={28} color={CORAL} concept={concept} seed={107} brightness={connected} />
          </svg>
          <span className="text-xs text-white/70">연결·감정이 깊은 별</span>
          <span className="text-[11px] tabular-nums text-mood-coral/80">밝기 {Math.round(connected * 100)}%</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden>
            <VizStar cx={50} cy={50} r={28} color={CORAL} concept={concept} seed={233} brightness={isolated} />
          </svg>
          <span className="text-xs text-white/50">홀로 떨어진 옅은 별</span>
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
        망각은 시간만의 함수가 아니에요 — <span className="text-white/60">연결이 많고, 자주 떠올리고,
        감정이 강한 별</span>일수록 천천히 멀어지며 밝게 머물러요. 같은 시간이 흘러도 고립된 옅은 별이{' '}
        <span className="text-white/60">두세 배 빨리</span> 저물죠. 그래도 아무리 오래 둬도 빛은{' '}
        {Math.round(A_MIN * 100)}% 아래로 꺼지지 않고, 회상 한 번이면 다시 깨어나요.
      </p>
    </div>
  )
}
