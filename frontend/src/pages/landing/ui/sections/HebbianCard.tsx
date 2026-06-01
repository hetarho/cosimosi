import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { GlassCard } from '@/shared/ui'
import { blobPath } from '@/shared/lib'
import { MOOD } from '@/shared/config'

/** 두 별의 결정론적 블롭 모양(시드 고정). */
const STAR_A = blobPath(101, { radius: 13, cx: 28, cy: 50, points: 7, variance: 0.3 })
const STAR_B = blobPath(202, { radius: 13, cx: 92, cy: 50, points: 7, variance: 0.3 })

/** 회상 강도(0~100)를 시냅스 시각 속성으로 매핑. 양방향: 강할수록 굵고 밝게, 약할수록 가늘고 흐리게. */
function synapseStyle(strength: number) {
  const t = strength / 100
  return {
    width: 0.8 + t * 5.2, // 0.8 ~ 6
    opacity: 0.12 + t * 0.78, // 0.12 ~ 0.9
    glow: 0.5 + t * 7.5, // blur stdDeviation
    starOpacity: 0.35 + t * 0.6,
  }
}

/** 강도에 따른 상태 라벨(LTP 강화 / 항상성 / LTD 약화) — 헵 가소성의 양방향성. */
function plasticityState(strength: number): { label: string; tone: string } {
  if (strength >= 62) return { label: '강화 (LTP) — 함께 발화 → 함께 연결', tone: 'text-mood-teal' }
  if (strength <= 32) return { label: '약화 (LTD) — 안 쓰면 연결이 가늘어짐', tone: 'text-white/45' }
  return { label: '평형 — 강화도 약화도 아닌 상태', tone: 'text-white/60' }
}

/** 헵 가소성 카드 — "함께 회상" 슬라이더로 두 별을 잇는 시냅스를 양방향으로 강화/약화. */
export function HebbianCard() {
  const reduce = useReducedMotion()
  const [strength, setStrength] = useState(50)
  const s = synapseStyle(strength)
  const state = plasticityState(strength)
  const teal = MOOD.teal

  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8">
      <span className="text-xs uppercase tracking-widest text-mood-teal/80">Hebbian Plasticity</span>
      <h3 className="font-display text-xl text-white/90 sm:text-2xl">
        헵 가소성 — 함께 발화하면 함께 연결
      </h3>
      <p className="text-sm leading-relaxed text-white/60">
        함께, 반복해서, 능동적으로 떠올린 기억일수록 둘을 잇는 시냅스가 굵어집니다(LTP).
        반대로 한동안 함께 떠올리지 않으면 같은 연결이 가늘어지죠(LTD). 강화와 약화는 늘
        함께 작동하는 양방향의 흐름입니다.
      </p>

      <div className="rounded-2xl border border-white/10 bg-space-900/40 p-4">
        <svg viewBox="0 0 120 100" className="h-32 w-full" role="img" aria-label="두 기억을 잇는 시냅스">
          <defs>
            <filter id="hebbian-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={s.glow} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="hebbian-star" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={teal} stopOpacity="0.95" />
              <stop offset="100%" stopColor={teal} stopOpacity="0.25" />
            </radialGradient>
          </defs>

          {/* 시냅스(빛의 선) — 강도에 따라 굵기·밝기·글로우가 함께 변함 */}
          <motion.line
            x1={41}
            y1={50}
            x2={79}
            y2={50}
            stroke={teal}
            strokeLinecap="round"
            filter="url(#hebbian-glow)"
            initial={false}
            animate={{ strokeWidth: s.width, opacity: s.opacity }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 22 }}
          />

          {/* 별 2개 (시드 블롭) */}
          <motion.path
            d={STAR_A}
            fill="url(#hebbian-star)"
            stroke={teal}
            strokeWidth={0.6}
            filter="url(#hebbian-glow)"
            initial={false}
            animate={{ opacity: s.starOpacity }}
            transition={reduce ? { duration: 0 } : { duration: 0.4 }}
          />
          <motion.path
            d={STAR_B}
            fill="url(#hebbian-star)"
            stroke={teal}
            strokeWidth={0.6}
            filter="url(#hebbian-glow)"
            initial={false}
            animate={{ opacity: s.starOpacity }}
            transition={reduce ? { duration: 0 } : { duration: 0.4 }}
          />
        </svg>

        <label className="mt-1 flex flex-col gap-2">
          <span className="flex items-center justify-between text-xs text-white/55">
            <span>함께 회상</span>
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

      <p className={`text-xs ${state.tone}`}>현재 상태 · {state.label}</p>
    </GlassCard>
  )
}
