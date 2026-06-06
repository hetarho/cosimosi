import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { GlassCard } from '@/shared/ui'
import { MOOD } from '@/shared/config'
import { useLandingTheme } from '../../model/theme'
import { VizStar, VizSynapse } from '../viz'

const VIOLET = MOOD.violet

/**
 * ENGRAM 카드. 뇌: 기억=뉴런 앙상블 → cosimosi: 별=기억, 빛의 선=시냅스.
 * 왼쪽 stylized 뉴런 ↔ 빛의 선(시냅스) ↔ 오른쪽 별(테마 시각 언어). hover 시 함께 pulse.
 */
export function EngramCard() {
  const reduce = useReducedMotion()
  const concept = useLandingTheme((s) => s.theme)
  const [active, setActive] = useState(false)

  const pulse =
    active && !reduce
      ? { scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }
      : { scale: 1, opacity: active ? 1 : 0.9 }
  const pulseTransition = { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const }

  const dendrites = ['M50 50 L18 26', 'M50 50 L14 52', 'M50 50 L24 78', 'M50 50 L48 14']

  return (
    <GlassCard
      className="flex flex-col gap-4 p-6 sm:p-8"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      tabIndex={0}
    >
      <span className="text-xs uppercase tracking-widest text-mood-violet/80">ENGRAM</span>
      <h3 className="font-display text-xl text-white/90 sm:text-2xl">엔그램 — 기억의 물리적 흔적</h3>
      <p className="text-sm leading-relaxed text-white/60">
        뇌에서 기억은 뉴런 앙상블로 저장되고, 뉴런들은 시냅스로 이어집니다. cosimosi에선 하나의
        일기가 별이 되고, 별과 별을 잇는 빛의 선이 그 시냅스입니다.
      </p>

      <div className="rounded-2xl border border-white/10 bg-space-900/40 p-4">
        <svg viewBox="0 0 240 100" className="h-auto w-full" role="img" aria-label="뉴런이 별(엔그램)로 매핑되는 모습">
          {/* 왼쪽: stylized 뉴런 (soma + dendrites) */}
          <motion.g animate={pulse} transition={active && !reduce ? pulseTransition : { duration: 0.4 }} style={{ transformOrigin: '50px 50px' }}>
            {dendrites.map((d) => (
              <path key={d} d={d} stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.5} />
            ))}
            <circle cx={50} cy={50} r={13} fill={VIOLET} fillOpacity={0.22} />
            <circle cx={50} cy={50} r={7} fill={VIOLET} fillOpacity={0.85} />
          </motion.g>

          {/* 가운데: 빛의 선(시냅스) + 매핑 화살표 */}
          <VizSynapse x1={92} y1={50} x2={146} y2={50} color={VIOLET} strength={active ? 0.95 : 0.5} arc={0.04} active={active} concept={concept} />
          <path
            d="M150 50 L141 45 M150 50 L141 55"
            stroke={VIOLET}
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
            opacity={active ? 0.9 : 0.45}
          />

          {/* 오른쪽: 별(엔그램) — 테마 시각 언어 */}
          <motion.g animate={pulse} transition={active && !reduce ? pulseTransition : { duration: 0.4 }} style={{ transformOrigin: '192px 50px' }}>
            <VizStar cx={192} cy={50} r={22} color={VIOLET} seed={7} concept={concept} active={active} />
          </motion.g>
        </svg>

        <div className="mt-3 flex items-center justify-between text-[11px] text-white/40">
          <span>뉴런 앙상블</span>
          <span>별 = 엔그램</span>
        </div>
      </div>

      <p className="text-xs text-white/40">
        {active ? '연결 활성 — 기억의 흔적이 빛납니다' : '커서를 올리면 시냅스가 깨어납니다'}
      </p>
    </GlassCard>
  )
}
