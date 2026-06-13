import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib'
import { MOOD } from '@/shared/config'
import { useAppearance } from '@/entities/appearance'
import { VizStar } from '@/entities/star'
import { TheoryBadge } from './TheoryBadge'

// 무대 좌표계.
const VW = 100
const VH = 60

/** 하나의 광원(nebula 풀) — 의미색·자리·크기·세기. 여러 개가 screen-가산으로 겹쳐
 *  단일 톤이 아닌 불규칙 그라디언트를 만든다(우주 3D AmbientNebula의 2D 대응). */
interface Orb {
  color: string
  x: number // %
  y: number // %
  size: number // % (지름)
  alpha: number
}

/** 요즘의 한 상태 = 최근 감정 분포의 7일 종합 결과. 같은 별들 위에 다른 하늘이 깔린다. */
interface MoodState {
  key: string
  label: string
  /** 0..1 종합 각성도 → 흥분성 게인 g = 1 + 0.3·arousal. */
  arousal: number
  /** 정서가 부호 — 양이면 따뜻한 하늘, 음이면 차가운 하늘. */
  warm: boolean
  orbs: Orb[]
  blurb: string
}

// 잔잔한 요즘 → 한두 색의 너른 광원. 격동한 요즘 → 여러 색이 불규칙하게 겹친 강렬한 하늘.
const STATES: MoodState[] = [
  {
    key: 'calm',
    label: '잔잔한 요즘',
    arousal: 0.18,
    warm: true,
    orbs: [
      { color: MOOD.teal, x: 42, y: 46, size: 78, alpha: 0.5 },
      { color: MOOD.amber, x: 64, y: 40, size: 52, alpha: 0.18 },
    ],
    blurb: '며칠째 평온하면, 하늘은 한 색으로 잦아들어요. 광원 한둘이 넓게 번질 뿐.',
  },
  {
    key: 'tender',
    label: '설레는 요즘',
    arousal: 0.58,
    warm: true,
    orbs: [
      { color: MOOD.amber, x: 32, y: 38, size: 60, alpha: 0.5 },
      { color: MOOD.pink, x: 64, y: 33, size: 54, alpha: 0.44 },
      { color: MOOD.violet, x: 50, y: 64, size: 50, alpha: 0.3 },
    ],
    blurb: '설렘이 번지면 금빛과 장미빛 광원이 여럿, 따뜻한 쪽으로 채도가 올라요.',
  },
  {
    key: 'turbulent',
    label: '격동하는 요즘',
    arousal: 0.9,
    warm: false,
    orbs: [
      { color: MOOD.coral, x: 28, y: 40, size: 60, alpha: 0.56 },
      { color: MOOD.violet, x: 67, y: 32, size: 58, alpha: 0.5 },
      { color: MOOD.pink, x: 48, y: 66, size: 54, alpha: 0.42 },
      { color: MOOD.teal, x: 78, y: 62, size: 42, alpha: 0.28 },
    ],
    blurb: '격동하면 여러 색 광원이 불규칙하게 겹쳐 강렬해지고, 차가운 쪽으로 탁해져요.',
  },
]

// 하늘이 바뀌어도 그대로인 별무리 — "같은 별들도 오늘의 하늘색이 다르면 다르게 보인다".
const STARS = [
  { x: 30, y: 24, r: 4.4, color: MOOD.teal, seed: 13 },
  { x: 52, y: 38, r: 3.6, color: MOOD.amber, seed: 28 },
  { x: 71, y: 22, r: 4.0, color: MOOD.pink, seed: 41 },
  { x: 44, y: 50, r: 3.2, color: MOOD.violet, seed: 57 },
  { x: 64, y: 47, r: 3.8, color: MOOD.coral, seed: 72 },
]

/**
 * "요즘 상태 — 같은 별들도 오늘의 하늘색이 다르면 다르게 보인다" (spec 25).
 * 최근 며칠의 감정을 7일 시간가중으로 종합하면, 우세한 감정 몇이 각각 하나의 넓은 광원이
 * 되어 우주의 배경을 물들여요 — 단일 톤이 아니라 군데군데 번지는 불규칙한 빛이에요. 별은
 * 그대로인데 하늘이 달라지면 우주의 인상이 달라지죠. 그리고 격동한 요즘일수록(높은 각성)
 * 새 기억을 끌어당기는 힘이 커져요 — 끌림 = 의미 + 0.25 × 흥분성, 흥분성은 g = 1 + 0.3 × 각성.
 */
export function AmbientMoodCard() {
  const reduce = useReducedMotion()
  const concept = useAppearance((s) => s.object)
  const [state, setState] = useState(0)
  const cur = STATES[state]
  const gain = 1 + 0.3 * cur.arousal

  return (
    <div className="flex flex-col gap-5">
      <figure className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-white/10 bg-space-900/60">
        {/* 다중 광원 배경 — 상태마다 한 겹씩 깔고 opacity로 ~0.8s 크로스페이드. 광원들은
            screen-가산으로 겹쳐 불규칙한 그라디언트가 된다(우주 AmbientNebula의 2D 대응). */}
        {STATES.map((st, i) => (
          <motion.div
            key={st.key}
            aria-hidden
            className="absolute inset-0"
            style={{ mixBlendMode: 'screen' }}
            initial={false}
            animate={{ opacity: state === i ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.8, ease: 'easeInOut' }}
          >
            {st.orbs.map((o, k) => (
              <div
                key={k}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${o.x}%`,
                  top: `${o.y}%`,
                  width: `${o.size}%`,
                  height: `${o.size}%`,
                  background: `radial-gradient(circle, ${o.color}${Math.round(o.alpha * 255)
                    .toString(16)
                    .padStart(2, '0')} 0%, transparent 70%)`,
                  filter: 'blur(8px)',
                }}
              />
            ))}
          </motion.div>
        ))}

        {/* 별무리 — 하늘이 바뀌어도 자리·색 그대로(별은 mood 의미색, 배경은 요즘색). */}
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="같은 별무리 위로 요즘의 감정에 따라 다른 하늘색이 번지는 모습"
        >
          {STARS.map((s, i) => (
            <VizStar
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              color={s.color}
              seed={s.seed}
              concept={concept}
              brightness={0.95}
              active
            />
          ))}
        </svg>

        {/* 따뜻↔차가움 라벨 — valence 부호가 하늘의 온도를 정한다. */}
        <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] text-white/55">
          {cur.warm ? '따뜻한 하늘 · valence +' : '차가운 하늘 · valence −'}
        </span>
      </figure>

      {/* 요즘 고르기. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-white/45">요즘의 상태</span>
        {STATES.map((st, i) => (
          <button
            key={st.key}
            type="button"
            onClick={() => setState(i)}
            aria-pressed={state === i}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              state === i
                ? 'border-white/40 text-white'
                : 'border-white/10 text-white/55 hover:text-white/80',
            )}
          >
            {st.label}
          </button>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-white/45">{cur.blurb}</p>

      {/* 흥분성 게인 — 격동한 요즘일수록 새 기억의 끌림이 커진다. */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-white/40">각성도</span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-mood-amber/80"
              initial={false}
              animate={{ width: `${cur.arousal * 100}%` }}
              transition={{ duration: reduce ? 0 : 0.6, ease: 'easeInOut' }}
            />
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-white/40">새 기억 끌림 게인</span>
          <p className="font-mono text-sm text-white/85">×{gain.toFixed(2)}</p>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-white/30">
        최근 며칠의 감정을 7일로 천천히 종합해, 우세한 감정 몇을 각각 하나의 넓은 광원으로 흩뿌려요 —
        배경은 단일 톤이 아니라 군데군데 번지는 불규칙한 빛이에요. 격동한 요즘일수록 새 기억을
        끌어당기는 힘이 세져요 — <span className="text-white/45">끌림 = 의미 + 0.25 × 흥분성</span>,
        흥분성은 <span className="text-white/45">g = 1 + 0.3 × 각성</span>이라 각성이 오르면 끌림도 함께 커져요.
      </p>

      <TheoryBadge status="done" plan="25" />
    </div>
  )
}
