import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Lock } from 'lucide-react'
import { GlassCard } from '@/shared/ui'
import { MOOD } from '@/shared/config'
import { useAppearance } from '@/entities/appearance'
import { VizStar } from '@/entities/star'
import { VizSynapse } from '@/entities/synapse'
import { TheoryBadge } from './TheoryBadge'
import { TryInUniverse } from './TryInUniverse'

/**
 * 기억 분할 카드(spec 21) — "기억은 조각난다": 일기 한 편이 사건 경계에서 색이 다른
 * 세 별로 갈라지고, 같은 하루의 조각끼리 강한 일내(intra-entry) 선으로 묶인다.
 * 활성(hover/포커스, 모바일은 in-view)되면 별·결속이 함께 pulse — 비활성에도 미세한
 * 숨쉬기를 유지한다(정적 금지). EngramCard의 크롬(GlassCard + 배지 + 체험하기) 재사용.
 */

// 조각 셋 — 하루 안의 세 장면(평온한 아침 → 뒤집힌 낮 → 풀린 밤). 색 = 감정.
const FRAGMENTS = [
  { label: '아침 · 평온', color: MOOD.teal, cx: 168, cy: 28, r: 15, seed: 11 },
  { label: '낮 · 분노', color: MOOD.coral, cx: 216, cy: 56, r: 17, seed: 47 },
  { label: '밤 · 안도', color: MOOD.amber, cx: 162, cy: 76, r: 13, seed: 83 },
] as const

export function FragmentationCard() {
  const reduce = useReducedMotion()
  const concept = useAppearance((s) => s.object)
  const [hovered, setHovered] = useState(false)
  const [inView, setInView] = useState(false)
  const active = hovered || inView

  const pulse =
    active && !reduce
      ? { scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }
      : { scale: 1, opacity: 0.92 }
  const pulseTransition = { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const }

  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8">
      <motion.div
        className="flex flex-col gap-4 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onViewportEnter={() => setInView(true)}
        onViewportLeave={() => setInView(false)}
        viewport={{ amount: 0.6 }}
        tabIndex={0}
      >
        <div className="rounded-2xl border border-white/10 bg-space-900/40 p-4">
          <svg
            viewBox="0 0 250 100"
            className="h-auto w-full"
            role="img"
            aria-label="일기 한 편이 색이 다른 세 개의 조각 별로 갈라져 강한 선으로 묶이는 모습"
          >
            {/* 왼쪽: 원본 일기 한 편 — 불변(자물쇠는 카피가 말한다) */}
            {/* 무한 루프는 in-view에서만 — 화면 밖 rAF 낭비 방지(밖에선 어차피 안 보인다). */}
            <motion.g
              animate={inView && !reduce ? { opacity: [0.75, 0.9, 0.75] } : { opacity: 0.85 }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <rect x={16} y={24} width={54} height={52} rx={6} fill="none" stroke="white" strokeOpacity={0.35} strokeWidth={1.4} />
              {/* 세 단락 = 세 장면, 각 조각의 감정 색으로 미리 물든다 */}
              <path d="M24 36 H62" stroke={FRAGMENTS[0].color} strokeWidth={2} strokeLinecap="round" opacity={active ? 0.9 : 0.55} />
              <path d="M24 42 H56" stroke={FRAGMENTS[0].color} strokeWidth={1.2} strokeLinecap="round" opacity={0.3} />
              <path d="M24 52 H62" stroke={FRAGMENTS[1].color} strokeWidth={2} strokeLinecap="round" opacity={active ? 0.9 : 0.55} />
              <path d="M24 58 H58" stroke={FRAGMENTS[1].color} strokeWidth={1.2} strokeLinecap="round" opacity={0.3} />
              <path d="M24 68 H62" stroke={FRAGMENTS[2].color} strokeWidth={2} strokeLinecap="round" opacity={active ? 0.9 : 0.55} />
            </motion.g>

            {/* 가운데: 사건 경계에서 갈라지는 흐름선 */}
            {FRAGMENTS.map((f) => (
              <motion.path
                key={f.label}
                d={`M72 50 C 105 50, 115 ${f.cy}, ${f.cx - f.r - 4} ${f.cy}`}
                fill="none"
                stroke={f.color}
                strokeWidth={1.4}
                strokeLinecap="round"
                animate={
                  inView && !reduce
                    ? { opacity: active ? [0.5, 0.95, 0.5] : [0.3, 0.45, 0.3] }
                    : { opacity: active ? 0.8 : 0.4 }
                }
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}

            {/* 오른쪽: 조각 별 셋 + 강한 일내 결속(intra-entry w=0.8) */}
            <VizSynapse x1={FRAGMENTS[0].cx} y1={FRAGMENTS[0].cy} x2={FRAGMENTS[1].cx} y2={FRAGMENTS[1].cy} color={MOOD.violet} strength={active ? 0.95 : 0.7} arc={0.12} active={active} concept={concept} />
            <VizSynapse x1={FRAGMENTS[1].cx} y1={FRAGMENTS[1].cy} x2={FRAGMENTS[2].cx} y2={FRAGMENTS[2].cy} color={MOOD.violet} strength={active ? 0.95 : 0.7} arc={0.12} active={active} concept={concept} />
            <VizSynapse x1={FRAGMENTS[0].cx} y1={FRAGMENTS[0].cy} x2={FRAGMENTS[2].cx} y2={FRAGMENTS[2].cy} color={MOOD.violet} strength={active ? 0.9 : 0.6} arc={-0.14} active={active} concept={concept} />
            {FRAGMENTS.map((f) => (
              <motion.g key={f.label} animate={pulse} transition={active && !reduce ? pulseTransition : { duration: 0.4 }} style={{ transformOrigin: `${f.cx}px ${f.cy}px` }}>
                <VizStar cx={f.cx} cy={f.cy} r={f.r} color={f.color} concept={concept} seed={f.seed} brightness={active ? 1 : 0.85} active={active} />
              </motion.g>
            ))}
          </svg>

          <div className="mt-3 flex items-center justify-between text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" aria-hidden />
              원본 일기는 그대로 1편
            </span>
            <span>조각마다 자기 감정의 별</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {FRAGMENTS.map((f) => (
            <span key={f.label} className="inline-flex items-center gap-1.5 text-white/55">
              <span aria-hidden className="size-2 rounded-full" style={{ background: f.color }} />
              {f.label}
            </span>
          ))}
        </div>

        <p className="text-xs leading-relaxed text-white/40">
          {active
            ? '하루가 사건의 경계에서 갈라졌어요 — 같은 일기에서 태어난 별들은 가장 굵은 선으로 묶여요.'
            : '다가가면, 일기 한 편이 여러 감정의 별로 갈라져요.'}
        </p>
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TheoryBadge status="done" plan="21" />
        <TryInUniverse sim="fragmentation" />
      </div>
    </GlassCard>
  )
}
