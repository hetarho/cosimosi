import { motion, useReducedMotion } from 'motion/react'
import { StarFieldCanvas } from './StarFieldCanvas'

/** 화면 고정 성운 배경: 느리게 떠다니는 그라데이션 블롭 3개 + 별 필드. 콘텐츠 뒤(-z-10). */
export function NebulaBackground() {
  const reduce = useReducedMotion()
  const float = (x: number[], y: number[], duration: number) =>
    reduce
      ? {}
      : { animate: { x, y }, transition: { duration, repeat: Infinity, ease: 'easeInOut' as const } }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050510]">
      <motion.div
        className="absolute -left-1/4 -top-[10%] h-[60vmax] w-[60vmax] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(127,119,221,0.30), transparent 60%)' }}
        {...float([0, 60, 0], [0, 40, 0], 38)}
      />
      <motion.div
        className="absolute -right-[15%] top-[18%] h-[55vmax] w-[55vmax] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(29,158,117,0.22), transparent 60%)' }}
        {...float([0, -50, 0], [0, 50, 0], 46)}
      />
      <motion.div
        className="absolute -bottom-[20%] left-[18%] h-[50vmax] w-[50vmax] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(212,83,126,0.18), transparent 60%)' }}
        {...float([0, 40, 0], [0, -30, 0], 54)}
      />
      <StarFieldCanvas className="absolute inset-0 h-full w-full" />
    </div>
  )
}
