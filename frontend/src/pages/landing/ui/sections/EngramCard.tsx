import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { GlassCard } from '@/shared/ui'
import { MOOD } from '@/shared/config'
import { useLandingTheme } from '../../model/theme'
import { useInView } from '../../lib/use-in-view'
import { useCoarsePointer } from '../../lib/use-coarse-pointer'
import { VizStar, VizSynapse } from '../viz'

const VIOLET = MOOD.violet

/**
 * ENGRAM 카드. 뇌: 기억=뉴런 앙상블 → cosimosi: 별=기억, 빛의 선=시냅스.
 * 왼쪽 stylized 뉴런 ↔ 빛의 선(시냅스) ↔ 오른쪽 별(테마 시각 언어). 다가가면 함께 pulse.
 * 데스크탑은 hover/focus로, 모바일(hover 없음)은 화면에 들어오면 깨어난다.
 */
export function EngramCard() {
  const reduce = useReducedMotion()
  const concept = useLandingTheme((s) => s.theme)
  const [hovered, setHovered] = useState(false)
  const { ref, visible } = useInView<HTMLDivElement>()
  const coarse = useCoarsePointer()
  const active = hovered || (coarse && visible)

  const pulse =
    active && !reduce
      ? { scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }
      : { scale: 1, opacity: active ? 1 : 0.9 }
  const pulseTransition = { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const }

  const dendrites = ['M50 50 L18 26', 'M50 50 L14 52', 'M50 50 L24 78', 'M50 50 L48 14']

  return (
    <GlassCard
      className="flex flex-col gap-4 p-6 sm:p-8"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
    >
      <div ref={ref} className="rounded-2xl border border-white/10 bg-space-900/40 p-4">
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

          {/* 오른쪽: 별(엔그램) — 테마별 SVG 오브제 */}
          <VizStar cx={192} cy={50} r={22} color={VIOLET} concept={concept} seed={7} brightness={active ? 1 : 0.9} active={active} />
        </svg>

        <div className="mt-3 flex items-center justify-between text-[11px] text-white/40">
          <span>뉴런 다발</span>
          <span>별 = 엔그램</span>
        </div>
      </div>

      <p className="text-xs text-white/40">
        {active ? '불이 들어왔어요. 마음에 새겨진 기억이 빛나요.' : '다가가면, 잠들었던 시냅스가 깨어나요.'}
      </p>
    </GlassCard>
  )
}
