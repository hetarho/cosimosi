import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { GlassCard } from '@/shared/ui'
import { cn } from '@/shared/lib'
import { MOOD } from '@/shared/config'
import { useLandingTheme } from '../../model/theme'
import { VizSynapse } from '../viz'
import { StarCanvas, Star3D } from '../star3d'

const ACCENT = MOOD.violet

/** stage 0=대기, 1=재활성화, 2=재분배, 3=요지추출, 4=가지치기/완료 */
const STAGES = [
  { label: '잠들기 전 — 낮에 담은 작은 성단', tag: '대기' },
  { label: '다시 깜빡인다 — 낮의 별들이 깨어난다', tag: '1 · 재활성화' },
  { label: '모여든다 — 별들이 큰 자리의 중심으로', tag: '2 · 재분배' },
  { label: '줄거리만 남는다 — 흐릿한 디테일을 덜어낸다', tag: '3 · 요지' },
  { label: '가지를 친다 — 약한 선을 가만히 정리한다', tag: '4 · 가지치기' },
] as const

const CX = 80
const CY = 55

/** 별 5개: 시작 좌표(흩어짐) + 중심 방향(재분배 후) */
const STARS = [
  { x: 24, y: 24, r: 6, weak: false },
  { x: 132, y: 30, r: 5, weak: true },
  { x: 30, y: 86, r: 4.5, weak: true },
  { x: 128, y: 84, r: 5.5, weak: false },
  { x: 78, y: 18, r: 5, weak: false },
] as const

/** 라인: 두 별 인덱스 + 약한 연결 여부(가지치기 대상) */
const LINKS = [
  { a: 4, b: 0, weak: false },
  { a: 4, b: 1, weak: true },
  { a: 0, b: 2, weak: true },
  { a: 4, b: 3, weak: false },
  { a: 0, b: 4, weak: false },
] as const

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

export function NightlyConsolidationCard() {
  const reduce = useReducedMotion()
  const concept = useLandingTheme((s) => s.theme)
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
        }, (i + 1) * 1100),
      )
    })
  }

  // 단계별 보간 진행도
  const gather = stage >= 2 ? 1 : 0 // 중심으로 모임
  const gist = stage >= 3 ? 1 : 0 // 단순·축소
  const pulse = stage === 1 // 재활성화 펄스
  const pruned = stage >= 4 // 약한 라인 fade

  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8" style={{ borderColor: `${ACCENT}33` }}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-space-900/60">
        <svg viewBox="0 0 160 110" className="block w-full" role="img" aria-label="야간 공고화 시뮬레이션">
          {/* 연결선(시냅스) — 약한 연결은 가지치기 단계에서 사라진다 */}
          {LINKS.map((l, i) => {
            const a = STARS[l.a]
            const b = STARS[l.b]
            const ax = lerp(a.x, CX, l.a === 4 ? 0 : gather * 0.55)
            const ay = lerp(a.y, CY, l.a === 4 ? 0 : gather * 0.55)
            const bx = lerp(b.x, CX, l.b === 4 ? 0 : gather * 0.55)
            const by = lerp(b.y, CY, l.b === 4 ? 0 : gather * 0.55)
            const faded = l.weak && pruned
            return (
              <motion.g key={`l-${i}`} animate={{ opacity: faded ? 0 : 1 }} transition={{ duration: reduce ? 0 : 0.6 }}>
                <VizSynapse x1={ax} y1={ay} x2={bx} y2={by} color={ACCENT} strength={l.weak ? 0.4 : 0.82} arc={0.1} concept={concept} />
              </motion.g>
            )
          })}
        </svg>

        {/* 별 — 테마별 WebGL 오브제. 중심으로 모이고(Star3D가 부드럽게 따라감), 요지화로 작아진다 */}
        <StarCanvas width={160} height={110} animated className="pointer-events-none absolute inset-0">
          {STARS.map((s, i) => {
            const tx = lerp(s.x, CX, gather * 0.55)
            const ty = lerp(s.y, CY, gather * 0.55)
            const radius = s.r * (1 - gist * 0.4)
            return (
              <Star3D
                key={i}
                concept={concept}
                color={ACCENT}
                x={tx}
                y={ty}
                r={radius}
                seed={i * 53 + 11}
                brightness={gist && s.weak ? 0.5 : 1}
                active={i === 4 || pulse}
              />
            )
          })}
        </StarCanvas>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-white/40">{STAGES[stage].label}</p>
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
