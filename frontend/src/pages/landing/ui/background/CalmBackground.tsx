import { motion, useReducedMotion } from 'motion/react'
import { StarFieldCanvas, GrainOverlay } from '@/shared/ui'

interface Orb {
  className: string
  color: string
  anim: { x: number[]; y: number[]; scale?: number[] }
  duration: number
}

// 잔잔한 우주 — 청록·아쿠아·민트·옅은 블루 색점이 screen 합성으로 겹쳐 아주 느리게 흐른다.
// 채도를 낮추고 속도를 늦춰 고요하고 평온한 오로라 커튼 결.
const ORBS: Orb[] = [
  {
    className: 'left-[-6%] top-[-8%] h-[58vmax] w-[58vmax]',
    color: 'rgba(63,214,181,0.42)', // teal
    anim: { x: [0, 50, 14, 0], y: [0, 40, 70, 0], scale: [1, 1.06, 1, 1] },
    duration: 40,
  },
  {
    className: 'right-[-8%] top-[2%] h-[52vmax] w-[52vmax]',
    color: 'rgba(110,200,230,0.34)', // aqua
    anim: { x: [0, -46, -8, 0], y: [0, 48, 16, 0], scale: [1.05, 0.97, 1.06, 1.05] },
    duration: 48,
  },
  {
    className: 'left-[12%] bottom-[-14%] h-[56vmax] w-[56vmax]',
    color: 'rgba(120,224,198,0.32)', // mint
    anim: { x: [0, 48, -24, 0], y: [0, -32, -6, 0], scale: [1, 1.08, 1, 1] },
    duration: 54,
  },
  {
    className: 'right-[8%] bottom-[-10%] h-[46vmax] w-[46vmax]',
    color: 'rgba(96,150,210,0.28)', // soft blue
    anim: { x: [0, -40, 12, 0], y: [0, -44, 10, 0], scale: [1, 0.95, 1.06, 1] },
    duration: 60,
  },
]

/**
 * 잔잔한 우주(calm) 배경 — 청록 계열 색점들이 깊은 밤 위로 아주 느리게 번지며 일렁이는
 * 그레이니 오로라 메시. 부드럽고 평온한 분위기.
 */
export function CalmBackground() {
  const reduce = useReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: 'radial-gradient(125% 100% at 50% 6%, #06201e 0%, #04120f 55%, var(--ld-base) 100%)' }}
    >
      {ORBS.map((o, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-[100px] ${o.className}`}
          style={{ background: `radial-gradient(circle, ${o.color}, transparent 64%)`, mixBlendMode: 'screen' }}
          animate={reduce ? undefined : o.anim}
          transition={{ duration: o.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      <StarFieldCanvas className="absolute inset-0 h-full w-full" count={90} maxAlpha={0.55} color="#cdeee6" />
      <GrainOverlay baseFrequency={0.85} />
    </div>
  )
}
