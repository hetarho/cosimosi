import { useId, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { GlassCard } from '@/shared/ui'
import { blobPath } from '@/shared/lib'
import { MOOD } from '@/shared/config'

// 별(엔그램)의 결정론적 윤곽 — 같은 시드면 늘 같은 모양.
const STAR_PATH = blobPath(7, { points: 7, radius: 30, variance: 0.32 })

/**
 * ENGRAM 카드.
 * 뇌: 기억 = 뉴런 앙상블, 시냅스로 연결 → cosimosi: 별 = 기억, 빛의 선 = 시냅스.
 * 왼쪽 stylized 뉴런 ↔ 매핑 화살표 ↔ 오른쪽 별(violet, 은은한 발광).
 * hover 시 뉴런과 별이 함께 pulse(useReducedMotion으로 분기).
 */
export function EngramCard() {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(false)
  const glowId = useId()
  const violet = MOOD.violet

  // hover/포커스 시 동시에 맥동. 모션 감소 환경에선 정적 강조만.
  const pulse =
    active && !reduce
      ? { scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }
      : { scale: 1, opacity: active ? 1 : 0.85 }
  const pulseTransition = { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const }

  // 뉴런 가지(dendrite) — soma(50,50)에서 뻗는 몇 개의 가지.
  const dendrites = [
    'M50 50 L18 26',
    'M50 50 L14 52',
    'M50 50 L24 78',
    'M50 50 L48 14',
  ]

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
      <h3 className="font-display text-xl text-white/90 sm:text-2xl">
        엔그램 — 기억의 물리적 흔적
      </h3>
      <p className="text-sm leading-relaxed text-white/60">
        뇌에서 기억은 뉴런 앙상블로 저장되고, 뉴런들은 시냅스로 이어집니다. cosimosi에선 하나의
        일기가 별이 되고, 별과 별을 잇는 빛의 선이 그 시냅스입니다.
      </p>

      <div className="rounded-2xl border border-white/10 bg-space-900/40 p-4">
        <svg
          viewBox="0 0 240 100"
          className="h-auto w-full"
          role="img"
          aria-label="뉴런이 별(엔그램)로 매핑되는 모습"
        >
          <defs>
            <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={violet} stopOpacity="0.55" />
              <stop offset="100%" stopColor={violet} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 왼쪽: stylized 뉴런 (soma + dendrites) */}
          <motion.g
            animate={pulse}
            transition={active && !reduce ? pulseTransition : { duration: 0.4 }}
            style={{ transformOrigin: '50px 50px' }}
          >
            {dendrites.map((d) => (
              <path
                key={d}
                d={d}
                stroke={violet}
                strokeWidth={1.6}
                strokeLinecap="round"
                fill="none"
                opacity={0.5}
              />
            ))}
            <circle cx={50} cy={50} r={13} fill={violet} fillOpacity={0.22} />
            <circle cx={50} cy={50} r={7} fill={violet} fillOpacity={0.85} />
          </motion.g>

          {/* 가운데: 매핑(시냅스 = 빛의 선) + 화살표 */}
          <line
            x1={92}
            y1={50}
            x2={148}
            y2={50}
            stroke={violet}
            strokeWidth={1.4}
            strokeDasharray="3 4"
            opacity={active ? 0.9 : 0.4}
          />
          <path
            d="M148 50 L140 46 M148 50 L140 54"
            stroke={violet}
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
            opacity={active ? 0.9 : 0.4}
          />

          {/* 오른쪽: 별(엔그램) — blobPath + 은은한 발광 */}
          <motion.g
            animate={pulse}
            transition={active && !reduce ? pulseTransition : { duration: 0.4 }}
            style={{ transformOrigin: '190px 50px' }}
          >
            <circle cx={190} cy={50} r={34} fill={`url(#${glowId})`} />
            <g transform="translate(160 20) scale(0.6)">
              <path d={STAR_PATH} fill={violet} fillOpacity={0.85} />
              <path d={STAR_PATH} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1} />
            </g>
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
