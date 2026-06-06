import { motion, useReducedMotion } from 'motion/react'
import { StarFieldCanvas } from '@/shared/ui'
import { GrainOverlay } from './GrainOverlay'

interface Blob {
  className: string
  color: string
  anim: { x: number[]; y: number[]; scale?: number[] }
  duration: number
}

// 채도 높은 색 덩어리들이 서로 다른 궤도로 돌며 녹아 흐르는 메시 그라디언트.
const BLOBS: Blob[] = [
  {
    className: 'left-[-10%] top-[-8%] h-[58vmax] w-[58vmax]',
    color: 'rgba(239,159,39,0.55)',
    anim: { x: [0, 120, 40, 0], y: [0, 60, 140, 0], scale: [1, 1.1, 0.95, 1] },
    duration: 26,
  },
  {
    className: 'right-[-12%] top-[2%] h-[54vmax] w-[54vmax]',
    color: 'rgba(212,83,126,0.55)',
    anim: { x: [0, -90, -30, 0], y: [0, 80, 30, 0], scale: [1.05, 0.95, 1.1, 1.05] },
    duration: 30,
  },
  {
    className: 'left-[8%] bottom-[-16%] h-[60vmax] w-[60vmax]',
    color: 'rgba(127,119,221,0.6)',
    anim: { x: [0, 80, -40, 0], y: [0, -50, -10, 0], scale: [1, 1.12, 1, 1] },
    duration: 34,
  },
  {
    className: 'right-[6%] bottom-[-12%] h-[46vmax] w-[46vmax]',
    color: 'rgba(29,158,117,0.5)',
    anim: { x: [0, -70, 20, 0], y: [0, -70, 20, 0], scale: [1, 0.92, 1.08, 1] },
    duration: 38,
  },
]

/**
 * 리퀴드(liquid) 테마 배경 — 채도 높은 색 덩어리들이 screen 합성으로 겹쳐 돌며
 * 녹아 흐르는 메시 그라디언트를 만든다. 현대적·아트워크 같은 결.
 */
export function LiquidBackground() {
  const reduce = useReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: 'radial-gradient(120% 100% at 50% 50%, #16082c 0%, #0c0420 60%, var(--ld-base) 100%)' }}
    >
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-[90px] ${b.className}`}
          style={{ background: `radial-gradient(circle, ${b.color}, transparent 65%)`, mixBlendMode: 'screen' }}
          animate={reduce ? undefined : b.anim}
          transition={{ duration: b.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* 광택 시트 — 위에서 비치는 옅은 빛 */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.06), transparent 30%)' }}
      />

      <StarFieldCanvas className="absolute inset-0 h-full w-full" count={70} maxAlpha={0.5} />
      <GrainOverlay baseFrequency={0.95} />
    </div>
  )
}
