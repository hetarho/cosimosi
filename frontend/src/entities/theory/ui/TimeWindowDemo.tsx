// 시냅스 시간 창 인터랙티브 데모 — 랜딩 TimeWindowCard의 시연 원본을 entity로 이식(spec 19).
// 실제 규칙대로 의미 base에 같은 날(24h 창) +0.3 보너스가 더해지고, 창이 닫혀도 의미
// 연결은 남는다(backend worker buildLinks의 거울 시연).
import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MOOD, VALUES } from '@/shared/config'
import { useAppearance } from '@/entities/appearance/@x/theory'
import { VizStar } from '@/entities/star/@x/theory'
import { VizSynapse } from '@/entities/synapse/@x/theory'

const ACCENT = MOOD.amber

// 슬라이더(0~1) → 시간 간격(시). 로그 스케일: 약 10분 ~ 1주.
const MIN_HOURS = 10 / 60
const MAX_HOURS = 24 * 7
const logMin = Math.log(MIN_HOURS)
const logMax = Math.log(MAX_HOURS)
const sliderToHours = (t: number) => Math.exp(logMin + (logMax - logMin) * t)

// 실제 우주의 규칙(spec 05): 연결은 의미 유사도로 생기고(τ=0.75·top-8), 같은 날이면
// +0.3 보너스. base는 "의미가 꽤 비슷한 두 기억"의 예시 강도.
const SEMANTIC_BASE = 0.45
const SAME_DAY_BONUS = VALUES.connection.temporalBonusMax
const WINDOW_HOURS = 24
const weightOf = (gapHours: number) =>
  Math.min(1, SEMANTIC_BASE + (gapHours < WINDOW_HOURS ? SAME_DAY_BONUS : 0))

const humanGap = (gapHours: number) => {
  if (gapHours < 1) return `${Math.round(gapHours * 60)}분`
  if (gapHours < 48) return `${Math.round(gapHours)}시간`
  return `${Math.round(gapHours / 24)}일`
}

// 무대 좌표(viewBox 0 0 100 56). 시간 간격이 커질수록 오른쪽 별이 멀어진다.
const STAGE_H = 56
const LEFT_X = 20
const RIGHT_MIN = 44
const RIGHT_MAX = 86
const STAR_Y = 28

export function TimeWindowDemo() {
  const reduce = useReducedMotion()
  const concept = useAppearance((s) => s.object)
  const sliderId = useId()
  const [t, setT] = useState(0.22) // 기본: 약 3시간 — 창이 열려 있는 상태에서 시작

  const gapHours = useMemo(() => sliderToHours(t), [t])
  const w = weightOf(gapHours)
  const inWindow = gapHours < WINDOW_HOURS
  const pct = Math.round(w * 100)
  const rightX = RIGHT_MIN + t * (RIGHT_MAX - RIGHT_MIN)

  return (
    <div className="flex flex-col gap-4">
      <span className="text-sm text-mood-amber/90">같은 하루 안의 인연은 더 또렷하게 맺어져요</span>

      <div className="rounded-2xl border border-white/10 bg-space-900/40 p-3">
        <svg viewBox={`0 0 100 ${STAGE_H}`} className="h-28 w-full" role="img" aria-label="두 기억을 잇는 시냅스의 시간 창">
          <VizSynapse x1={LEFT_X} y1={STAR_Y} x2={rightX} y2={STAR_Y} color={ACCENT} strength={w} arc={0.18} active={inWindow} concept={concept} />
          <VizStar cx={LEFT_X} cy={STAR_Y} r={6.5} color={ACCENT} concept={concept} seed={71} />
          <VizStar cx={rightX} cy={STAR_Y} r={6} color={ACCENT} concept={concept} seed={42} brightness={0.5 + w * 0.5} />
          <text x={LEFT_X} y={STAGE_H - 6} textAnchor="middle" fill="#ffffff" fillOpacity={0.4} style={{ fontSize: 5 }}>
            먼저 쓴 기억
          </text>
          <text x={rightX} y={STAGE_H - 6} textAnchor="middle" fill="#ffffff" fillOpacity={0.4} style={{ fontSize: 5 }}>
            나중에 쓴 기억
          </text>
        </svg>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={sliderId} className="flex items-baseline justify-between text-xs text-white/50">
          <span>두 기억 사이에 흐른 시간</span>
          <span className="font-display text-base tabular-nums" style={{ color: ACCENT }}>
            {humanGap(gapHours)}
          </span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="w-full cursor-pointer accent-mood-amber"
          aria-valuetext={`간격 ${humanGap(gapHours)}, 연결 강도 ${pct}%`}
        />
        <div className="flex justify-between text-[10px] text-white/30">
          <span>10분</span>
          <span>6시간</span>
          <span>1일</span>
          <span>1주</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>이어진 정도</span>
          <span className="tabular-nums text-white/80">
            {w.toFixed(2)}
            <span className="text-white/40"> = 의미 {SEMANTIC_BASE}</span>
            {inWindow && <span className="text-mood-amber/90"> + 같은 날 {SAME_DAY_BONUS}</span>}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: ACCENT }}
            animate={{ width: `${pct}%` }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
          />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        {inWindow
          ? `${humanGap(gapHours)} 사이 — 시간 창이 열려 있어요. 같은 하루의 인연이라 +0.3 더 또렷하게 이어져요.`
          : `${humanGap(gapHours)}이 지나 창이 닫혔어요 — 보너스는 사라지지만, 의미가 닮은 두 기억은 여전히 이어져 있어요.`}
      </p>
    </div>
  )
}
