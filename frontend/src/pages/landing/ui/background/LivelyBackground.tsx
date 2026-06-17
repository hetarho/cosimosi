import { motion, useReducedMotion } from 'motion/react'
import { StarFieldCanvas, GrainOverlay } from '@/shared/ui'

interface Blob {
  className: string
  color: string
  anim: { x: number[]; y: number[]; scale?: number[] }
  duration: number
}

// 경쾌한 우주 — 채도 높은 자홍·앰버·핑크·바이올렛 덩어리가 서로 다른 궤도로 돌며 녹아 흐르는
// 메시 그라디언트. 따뜻하고 생동감 있는 결.
const BLOBS: Blob[] = [
  {
    className: 'left-[-10%] top-[-8%] h-[58vmax] w-[58vmax]',
    color: 'rgba(255,153,80,0.55)', // amber
    anim: { x: [0, 120, 40, 0], y: [0, 60, 140, 0], scale: [1, 1.1, 0.95, 1] },
    duration: 24,
  },
  {
    className: 'right-[-12%] top-[2%] h-[54vmax] w-[54vmax]',
    color: 'rgba(255,95,160,0.55)', // pink/magenta
    anim: { x: [0, -90, -30, 0], y: [0, 80, 30, 0], scale: [1.05, 0.95, 1.1, 1.05] },
    duration: 28,
  },
  {
    className: 'left-[8%] bottom-[-16%] h-[60vmax] w-[60vmax]',
    color: 'rgba(199,123,255,0.55)', // violet
    anim: { x: [0, 80, -40, 0], y: [0, -50, -10, 0], scale: [1, 1.12, 1, 1] },
    duration: 32,
  },
  {
    className: 'right-[6%] bottom-[-12%] h-[46vmax] w-[46vmax]',
    color: 'rgba(255,158,199,0.5)', // rose
    anim: { x: [0, -70, 20, 0], y: [0, -70, 20, 0], scale: [1, 0.92, 1.08, 1] },
    duration: 36,
  },
]

/**
 * 경쾌한 우주(lively) 배경 — 채도 높은 색 덩어리들이 screen 합성으로 겹쳐 돌며 녹아 흐르는
 * 메시 그라디언트. 현대적·아트워크 같은 결, 따뜻하고 발랄한 분위기.
 */
export function LivelyBackground() {
  const reduce = useReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: 'radial-gradient(120% 100% at 50% 50%, #2a0c2c 0%, #16061f 60%, var(--ld-base) 100%)' }}
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

      {/* 위에서 비치는 옅은 광택 시트 */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.06), transparent 30%)' }}
      />

      <StarFieldCanvas className="absolute inset-0 h-full w-full" count={70} maxAlpha={0.5} />
      <GrainOverlay baseFrequency={0.95} />
    </div>
  )
}
