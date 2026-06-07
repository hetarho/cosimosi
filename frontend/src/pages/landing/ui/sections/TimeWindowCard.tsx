import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { GlassCard } from '@/shared/ui'
import { MOOD } from '@/shared/config'
import { useLandingTheme } from '../../model/theme'
import { VizSynapse } from '../viz'
import { StarCanvas, Star3D } from '../star3d'

const ACCENT = MOOD.amber

// 슬라이더(0~1) → 시간 간격(시). 로그 스케일: 약 10분 ~ 30일.
const MIN_HOURS = 10 / 60
const MAX_HOURS = 24 * 30
const logMin = Math.log(MIN_HOURS)
const logMax = Math.log(MAX_HOURS)
const sliderToHours = (t: number) => Math.exp(logMin + (logMax - logMin) * t)

// 연결 강도(0~1). 수 시간~하루까지는 강하게 유지되다가 하루(24h)부터 가파르게 감소,
// 약 1주(168h)면 거의 0. 가드레일: 연결의 시간 창은 "수 시간~하루"이며 일주일이면 사라진다.
const strength = (gapHours: number) => {
  const onset = 24
  if (gapHours <= onset) return 1 - 0.15 * (gapHours / onset)
  const decay = (gapHours - onset) / (168 - onset)
  return Math.max(0, 0.85 * Math.exp(-3.4 * decay))
}

// 사람이 읽는 간격 라벨.
const humanGap = (gapHours: number) => {
  if (gapHours < 1) return `${Math.round(gapHours * 60)}분`
  if (gapHours < 48) return `${Math.round(gapHours)}시간`
  const days = gapHours / 24
  if (days < 7) return `${Math.round(days)}일`
  if (days < 30) return `${Math.round(days / 7)}주`
  return `${Math.round(days / 30)}달`
}

// 무대 좌표(viewBox 0 0 100 56). 시간 간격이 커질수록 오른쪽 별이 멀어진다(시간이 둘을 떼어 놓는다).
const STAGE_H = 56
const LEFT_X = 20
const RIGHT_MIN = 44
const RIGHT_MAX = 86
const STAR_Y = 28

export function TimeWindowCard() {
  const reduce = useReducedMotion()
  const concept = useLandingTheme((s) => s.theme)
  const sliderId = useId()
  const [t, setT] = useState(0.18) // 기본: 약 3시간

  const gapHours = useMemo(() => sliderToHours(t), [t])
  const s = useMemo(() => strength(gapHours), [gapHours])
  const pct = Math.round(s * 100)
  const rightX = RIGHT_MIN + t * (RIGHT_MAX - RIGHT_MIN)

  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8">
      <span className="text-xs uppercase tracking-widest text-mood-amber/80">MEMORY LINKING</span>
      <h3 className="font-display text-xl text-white/90 sm:text-2xl">기억 연결의 시간 창</h3>
      <p className="text-sm leading-relaxed text-white/60">
        비슷한 시기에 쓴 기억끼리 시냅스로 엮입니다. 하지만 그 창은 수 시간에서 하루로 짧아서, 하루가
        지나면 빠르게 닫히고 일주일쯤 되면 연결은 거의 남지 않습니다. 슬라이더로 두 기억 사이의
        간격을 바꿔 보세요.
      </p>

      <div className="flex flex-col gap-4">
        {/* 두 기억(별)과 그 사이 시냅스 — 간격이 멀어질수록 별이 떨어지고 연결이 약해진다 */}
        <div className="rounded-2xl border border-white/10 bg-space-900/40 p-3">
          <div className="relative">
            <svg viewBox={`0 0 100 ${STAGE_H}`} className="h-28 w-full" role="img" aria-label="두 기억을 잇는 시냅스의 시간 창">
              <VizSynapse x1={LEFT_X} y1={STAR_Y} x2={rightX} y2={STAR_Y} color={ACCENT} strength={s} arc={0.18} active={s >= 0.6} concept={concept} />
              <text x={LEFT_X} y={STAGE_H - 6} textAnchor="middle" fill="#ffffff" fillOpacity={0.4} style={{ fontSize: 5 }}>
                어제의 기억
              </text>
              <text x={rightX} y={STAGE_H - 6} textAnchor="middle" fill="#ffffff" fillOpacity={0.4} style={{ fontSize: 5 }}>
                새 기억
              </text>
            </svg>
            <StarCanvas width={100} height={STAGE_H} animated className="pointer-events-none absolute inset-0">
              <Star3D concept={concept} color={ACCENT} x={LEFT_X} y={STAR_Y} r={6.5} seed={71} />
              <Star3D concept={concept} color={ACCENT} x={rightX} y={STAR_Y} r={6} seed={42} brightness={0.5 + s * 0.5} />
            </StarCanvas>
          </div>
        </div>

        {/* 슬라이더 */}
        <div className="flex flex-col gap-2">
          <label htmlFor={sliderId} className="flex items-baseline justify-between text-xs text-white/50">
            <span>두 기억 사이 시간 간격</span>
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
            <span>1일</span>
            <span>1주</span>
            <span>1달</span>
          </div>
        </div>

        {/* 연결 강도 막대 + 퍼센트 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>연결 강도</span>
            <span className="tabular-nums text-white/80">{pct}%</span>
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
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        {pct >= 60
          ? `간격 ${humanGap(gapHours)} · 두 별이 강한 빛의 선으로 이어집니다.`
          : pct >= 15
            ? `간격 ${humanGap(gapHours)} · 연결이 옅어지고 있습니다.`
            : `간격 ${humanGap(gapHours)} · 시간 창이 닫혀 거의 이어지지 않습니다.`}
      </p>
    </GlassCard>
  )
}
