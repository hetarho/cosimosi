import { useState } from 'react'
import { GlassCard } from '@/shared/ui'
import { MOOD } from '@/shared/config'
import { useLandingTheme } from '../../model/theme'
import { VizStar, VizSynapse } from '../viz'

const TEAL = MOOD.teal

/** 강도에 따른 상태 라벨(LTP 강화 / 항상성 / LTD 약화) — 헵 가소성의 양방향성. */
function plasticityState(strength: number): { label: string; tone: string } {
  if (strength >= 62) return { label: '굵어져요 — 함께 떠올린 만큼 또렷하게 (LTP)', tone: 'text-mood-teal' }
  if (strength <= 32) return { label: '가늘어져요 — 오래 멀어진 인연은 옅어져요 (LTD)', tone: 'text-white/45' }
  return { label: '어느 쪽도 아닌, 잔잔한 평형', tone: 'text-white/60' }
}

/** 헵 가소성 카드 — "함께 회상" 슬라이더로 두 별을 잇는 시냅스를 양방향으로 강화/약화. */
export function HebbianCard() {
  const concept = useLandingTheme((s) => s.theme)
  const [strength, setStrength] = useState(50)
  const t = strength / 100
  const state = plasticityState(strength)

  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8">
      <span className="text-sm text-mood-teal/90">함께 떠올릴수록, 둘을 잇는 선이 굵어져요</span>

      <div className="rounded-2xl border border-white/10 bg-space-900/40 p-4">
        <svg viewBox="0 0 120 64" className="h-32 w-full" role="img" aria-label="두 기억을 잇는 시냅스">
          <VizSynapse x1={28} y1={32} x2={92} y2={32} color={TEAL} strength={t} arc={0.16} active={strength >= 62} concept={concept} />
          <VizStar cx={28} cy={32} r={11} color={TEAL} concept={concept} seed={101} brightness={0.5 + t * 0.5} active={strength >= 62} />
          <VizStar cx={92} cy={32} r={11} color={TEAL} concept={concept} seed={202} brightness={0.5 + t * 0.5} active={strength >= 62} />
        </svg>

        <label className="mt-1 flex flex-col gap-2">
          <span className="flex items-center justify-between text-xs text-white/55">
            <span>함께 떠올린 정도</span>
            <span className="tabular-nums text-mood-teal/90">{strength}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            aria-label="함께 회상 강도"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-mood-teal"
          />
        </label>
      </div>

      <p className={`text-xs ${state.tone}`}>지금 · {state.label}</p>
    </GlassCard>
  )
}
