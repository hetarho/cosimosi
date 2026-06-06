import { motion, useReducedMotion } from 'motion/react'
import { StarFieldCanvas } from '@/shared/ui'
import { GrainOverlay } from './GrainOverlay'

interface Orb {
  className: string
  color: string
  anim: { x: number[]; y: number[]; scale?: number[] }
  duration: number
}

// 그레이니 오로라 메시 — 인디고·바이올렛·로즈·틸 색점이 screen 합성으로 겹쳐
// 느리게 흐른다. 여러 점이 유기적으로 섞이는 mesh-gradient 결.
const ORBS: Orb[] = [
  {
    className: 'left-[-6%] top-[-8%] h-[58vmax] w-[58vmax]',
    color: 'rgba(120,104,230,0.5)',
    anim: { x: [0, 70, 20, 0], y: [0, 50, 90, 0], scale: [1, 1.08, 1, 1] },
    duration: 30,
  },
  {
    className: 'right-[-8%] top-[2%] h-[52vmax] w-[52vmax]',
    color: 'rgba(120,150,255,0.4)',
    anim: { x: [0, -60, -10, 0], y: [0, 60, 20, 0], scale: [1.05, 0.96, 1.08, 1.05] },
    duration: 36,
  },
  {
    className: 'left-[12%] bottom-[-14%] h-[56vmax] w-[56vmax]',
    color: 'rgba(255,158,199,0.36)',
    anim: { x: [0, 60, -30, 0], y: [0, -40, -8, 0], scale: [1, 1.1, 1, 1] },
    duration: 40,
  },
  {
    className: 'right-[8%] bottom-[-10%] h-[46vmax] w-[46vmax]',
    color: 'rgba(127,224,198,0.32)',
    anim: { x: [0, -50, 16, 0], y: [0, -54, 12, 0], scale: [1, 0.94, 1.08, 1] },
    duration: 46,
  },
]

/**
 * Noir Aurora 테마 배경 — 흐르는 그레이니 오로라 메시. 깊은 밤 위로 색점들이 번지며
 * 천천히 일렁이고, 그레인이 몽환적 질감을 입힌다.
 */
export function AuroraBackground() {
  const reduce = useReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: 'radial-gradient(125% 100% at 50% 6%, #0e0a22 0%, #08060f 55%, var(--ld-base) 100%)' }}
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

      <StarFieldCanvas className="absolute inset-0 h-full w-full" count={90} maxAlpha={0.6} />
      <GrainOverlay baseFrequency={0.85} />
    </div>
  )
}
