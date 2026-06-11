import { useEffect, useRef, useState } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { GlassCard } from '@/shared/ui'
import { cn } from '@/shared/lib'
import { MOOD } from '@/shared/config'
import { useAppearance } from '@/entities/appearance'
import { VizStar } from '@/entities/star'
import { VizSynapse } from '@/entities/synapse'
import { TheoryBadge } from './TheoryBadge'

const ACCENT = MOOD.violet

/** stage 0=대기, 1=재활성화(깜빡), 2=재분배(중심으로 모임), 3=요지(축소·약한 별 흐려짐), 4=가지치기(약한 선 제거) */
const STAGES = [
  { label: '잠들기 전 — 낮에 담은 작은 성단', tag: '대기' },
  { label: '다시 깜빡여요 — 낮의 별들이 깨어나요', tag: '1 · 재활성화' },
  { label: '모여들어요 — 더 큰 자리의 중심으로', tag: '2 · 재분배' },
  { label: '줄거리만 남겨요 — 흐릿한 디테일을 덜어내요', tag: '3 · 요지' },
  { label: '가지를 쳐요 — 약한 선을 가만히 정리해요', tag: '4 · 가지치기' },
] as const

const CX = 80
const CY = 56

/** 별 5개: 시작 좌표(흩어짐) + weak(요지화에서 흐려지고, 그 별로 가는 선이 가지치기 대상). */
const STARS = [
  { x: 26, y: 26, r: 6.5, weak: false },
  { x: 134, y: 30, r: 5, weak: true },
  { x: 32, y: 88, r: 4.5, weak: true },
  { x: 128, y: 86, r: 6, weak: false },
  { x: 80, y: 22, r: 7, weak: false },
] as const

/** 연결: 두 별 인덱스 + 약한 연결 여부(가지치기 대상). */
const LINKS = [
  { a: 4, b: 0, weak: false },
  { a: 4, b: 1, weak: true },
  { a: 0, b: 2, weak: true },
  { a: 4, b: 3, weak: false },
  { a: 0, b: 4, weak: false },
] as const

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/** target으로 부드럽게 따라가는 값. 별과 시냅스가 이 값을 공유해 같은 좌표로 그려지므로 절대 어긋나지 않는다. */
function useEased(target: number, duration: number) {
  const [v, setV] = useState(target)
  useEffect(() => {
    const controls = animate(v, target, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setV })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])
  return v
}

export function NightlyConsolidationCard() {
  const reduce = useReducedMotion()
  const concept = useAppearance((s) => s.object)
  const [stage, setStage] = useState(0)
  const [running, setRunning] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [])

  const runNight = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (reduce) {
      setStage(4)
      setRunning(false)
      return
    }
    setRunning(true)
    setStage(1)
    ;[2, 3, 4].forEach((next, i) => {
      timers.current.push(
        setTimeout(() => {
          setStage(next)
          if (next === 4) setRunning(false)
        }, (i + 1) * 1200),
      )
    })
  }

  const dur = reduce ? 0 : 0.9
  const gather = useEased(stage >= 2 ? 1 : 0, dur) // 중심으로 모임
  const gist = useEased(stage >= 3 ? 1 : 0, dur) // 축소·요지화
  const prune = useEased(stage >= 4 ? 1 : 0, reduce ? 0 : 0.6) // 약한 선 제거
  const pulse = stage === 1 // 재활성화 깜빡

  // 단일 좌표 소스 — 별과 시냅스가 동일 positions를 참조하므로 어떤 단계에서도 정확히 붙어 움직인다.
  const positions = STARS.map((s) => ({
    x: lerp(s.x, CX, gather * 0.6),
    y: lerp(s.y, CY, gather * 0.6),
    r: s.r * (1 - gist * 0.4),
    dim: s.weak ? 1 - gist * 0.55 : 1,
  }))

  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8" style={{ borderColor: `${ACCENT}33` }}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-space-900/60">
        <svg viewBox="0 0 160 112" className="block w-full" role="img" aria-label="야간 공고화 시뮬레이션">
          {/* '더 큰 자리' — 모이기 시작하면 중심에 옅은 자리빛이 떠올라, 별들이 어디로 합쳐지는지 보여준다. */}
          <circle cx={CX} cy={CY} r={28} fill={ACCENT} opacity={gather * 0.07} />
          <circle cx={CX} cy={CY} r={28} fill="none" stroke={ACCENT} strokeOpacity={gather * 0.2} strokeDasharray="2 3.5" />

          {/* 시냅스 — positions 공유. 약한 선은 가지치기에서 부드럽게 사라진다. */}
          {LINKS.map((l, i) => {
            const a = positions[l.a]
            const b = positions[l.b]
            return (
              <g key={`l-${i}`} opacity={l.weak ? 1 - prune : 1}>
                <VizSynapse
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  color={ACCENT}
                  strength={l.weak ? 0.4 : 0.82}
                  arc={0.1}
                  active={gather > 0.4}
                  concept={concept}
                />
              </g>
            )
          })}

          {/* 별 — positions 공유. 재활성화 때 그룹이 함께 깜빡이고, 요지화로 작아지며 약한 별은 흐려진다. */}
          <motion.g
            animate={pulse && !reduce ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
            transition={pulse && !reduce ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          >
            {positions.map((p, i) => (
              <g key={`s-${i}`} opacity={p.dim}>
                <VizStar
                  cx={p.x}
                  cy={p.y}
                  r={p.r}
                  color={ACCENT}
                  concept={concept}
                  seed={i * 53 + 11}
                  active={!STARS[i].weak && (pulse || gather > 0.6)}
                />
              </g>
            ))}
          </motion.g>
        </svg>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-white/40">{STAGES[stage].label}</p>
        <TheoryBadge status="planned" plan="27" className="shrink-0" />
        <button
          type="button"
          onClick={runNight}
          disabled={running}
          className={cn(
            'shrink-0 rounded-full border border-mood-violet/40 px-4 py-1.5 text-xs font-medium text-white/90 transition',
            running ? 'cursor-default opacity-50' : 'hover:border-mood-violet/70 hover:bg-mood-violet/10',
          )}
        >
          {stage === 0 ? '밤 보내기' : running ? STAGES[stage].tag : '다시'}
        </button>
      </div>
    </GlassCard>
  )
}
