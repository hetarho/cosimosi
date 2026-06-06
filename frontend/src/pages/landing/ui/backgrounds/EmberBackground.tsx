import { motion, useReducedMotion } from 'motion/react'
import { StarFieldCanvas } from '@/shared/ui'
import { GrainOverlay } from './GrainOverlay'

/**
 * Ink & Ember 테마 배경 — 거의 먹빛(near-black)에 단 하나의 따뜻한 잉걸 글로우.
 * 강한 그레인이 인쇄물 같은 질감을 준다. 극도의 절제 = 갤러리/에디토리얼.
 */
export function EmberBackground() {
  const reduce = useReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: 'radial-gradient(130% 100% at 40% 32%, #140c08 0%, #0a0706 50%, var(--ld-base) 100%)' }}
    >
      {/* 단 하나의 잉걸 글로우 — 느리게 호흡 */}
      <motion.div
        className="absolute left-[34%] top-[14%] h-[62vmax] w-[62vmax] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(239,122,58,0.42), rgba(216,90,46,0.12) 42%, transparent 70%)' }}
        animate={reduce ? undefined : { opacity: [0.78, 1, 0.78], scale: [1, 1.06, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* 차가운 대비 — 깊이만 더하는 아주 옅은 한 점 */}
      <div
        className="absolute bottom-[-18%] right-[6%] h-[44vmax] w-[44vmax] rounded-full blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgba(58,72,120,0.16), transparent 66%)' }}
      />
      {/* 비네트 */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />

      <StarFieldCanvas className="absolute inset-0 h-full w-full" count={64} maxAlpha={0.45} color="#ffd9be" />
      <GrainOverlay baseFrequency={0.78} />
    </div>
  )
}
