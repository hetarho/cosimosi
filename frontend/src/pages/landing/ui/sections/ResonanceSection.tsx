import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { GlassCard } from '@/shared/ui'
import { mulberry32 } from '@/shared/lib'
import { MOOD } from '@/shared/config'
import { useLandingTheme } from '../../model/theme'
import { VizStar, VizSynapse } from '../viz'
import type { VizConcept } from '../viz'

// 좌/우 두 사람의 우주에 새겨진 같은 사건의 별. seed 고정 → 결정론적 모양.
const ME = { seed: 0x5e0f, mood: MOOD.violet, label: '나의 별' } as const
const FRIEND = { seed: 0xa17c, mood: MOOD.teal, label: '친구의 별' } as const

// 작은 우주 1개(원형 영역 + 별 + 잔별 몇 개). viewBox 100x100 좌표계.
function MiniUniverse({
  seed,
  mood,
  bright,
  concept,
}: {
  seed: number
  mood: string
  bright: boolean
  concept: VizConcept
}) {
  const rand = mulberry32(seed)
  const dust = Array.from({ length: 7 }, () => ({
    x: 12 + rand() * 76,
    y: 12 + rand() * 76,
    r: 0.6 + rand() * 1.1,
  }))
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <circle cx="50" cy="50" r="46" fill={mood} fillOpacity={0.05} />
      <circle cx="50" cy="50" r="46" fill="none" stroke={mood} strokeOpacity={0.18} />
      {dust.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#dfe3ff" fillOpacity={0.35} />
      ))}
      <VizStar cx={50} cy={50} r={18} color={mood} concept={concept} seed={seed} brightness={bright ? 1 : 0.5} />
    </svg>
  )
}

export function ResonanceSection() {
  const reduce = useReducedMotion()
  const concept = useLandingTheme((s) => s.theme)
  const [resonant, setResonant] = useState(false)

  return (
    <GlassCard className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="relative">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            <figure className="flex flex-col items-center gap-2">
              <div className="aspect-square w-full max-w-[160px]">
                <MiniUniverse seed={ME.seed} mood={ME.mood} bright concept={concept} />
              </div>
              <figcaption className="text-xs text-white/50">{ME.label}</figcaption>
            </figure>

            {/* 가운데 공명 선: resonant일 때 이어짐. 빛알갱이가 오간다(모션 줄이면 정적). */}
            <div className="relative flex h-24 w-16 items-center justify-center sm:w-28">
              {/* 공명할 때 join에 번지는 숨쉬는 빛무리. */}
              {resonant && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ background: `radial-gradient(circle, ${MOOD.amber}44 0%, transparent 70%)` }}
                  initial={{ opacity: 0 }}
                  animate={reduce ? { opacity: 0.5 } : { opacity: [0.3, 0.6, 0.3] }}
                  transition={reduce ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <svg viewBox="0 0 100 40" className="h-full w-full" aria-hidden>
                <VizSynapse
                  x1={6}
                  y1={20}
                  x2={94}
                  y2={20}
                  color={MOOD.amber}
                  strength={resonant ? 0.85 : 0.14}
                  arc={0.05}
                  active={resonant}
                  concept={concept}
                />
                {resonant && !reduce && (
                  <motion.circle
                    r="2.6"
                    fill={MOOD.amber}
                    cy="20"
                    initial={{ cx: 6, opacity: 0 }}
                    animate={{ cx: [6, 94], opacity: [0, 1, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                {resonant && reduce && <circle cx="50" cy="20" r="2.6" fill={MOOD.amber} />}
              </svg>
            </div>

            <figure className="flex flex-col items-center gap-2">
              <div className="aspect-square w-full max-w-[160px]">
                <MiniUniverse seed={FRIEND.seed} mood={FRIEND.mood} bright={resonant} concept={concept} />
              </div>
              <figcaption className="text-xs text-white/50">{FRIEND.label}</figcaption>
            </figure>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setResonant((v) => !v)}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-white/80 transition hover:bg-white/10"
            aria-pressed={resonant}
          >
            {resonant ? '공명 풀기' : '친구가 같은 날을 다시 쓰다'}
          </button>
          <p className="text-xs text-white/40">
            {resonant
              ? '두 별이 공명해요. 같은 밤을 함께 떠올릴수록 빛줄기가 또렷해져요.'
              : '아직 두 별은 각자의 우주에서 따로 빛나요.'}
          </p>
        </div>
      </GlassCard>
  )
}
