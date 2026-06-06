import { motion, useReducedMotion } from 'motion/react'
import { StarFieldCanvas } from '@/shared/ui'
import { GrainOverlay } from './GrainOverlay'

/**
 * 딥필드(deepfield) 테마 배경 — 망원경이 담은 깊은 우주. 아주 어둡고, 고밀도 별 필드가
 * 깊이별 시차로 떠다니며, 원거리 성운 글로우는 희미하다. 강한 필름 그레인이 사진 같은 질감을 준다.
 */
export function DeepFieldBackground() {
  const reduce = useReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: 'radial-gradient(140% 110% at 62% 38%, #0a0f24 0%, #05060f 50%, var(--ld-base) 100%)' }}
    >
      {/* 원거리 성운 글로우 — 아주 옅고 거의 정지 */}
      <motion.div
        className="absolute right-[14%] top-[22%] h-[58vmax] w-[72vmax] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(64,84,150,0.22), rgba(40,30,60,0.08) 45%, transparent 70%)' }}
        animate={reduce ? undefined : { opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="absolute left-[6%] bottom-[8%] h-[40vmax] w-[52vmax] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(120,70,60,0.12), transparent 65%)' }}
      />

      {/* 두 겹 별 필드 — 먼 별(고밀도·작고 흐림) + 가까운 별(성기고 밝음, 시차 큼) */}
      <StarFieldCanvas
        className="absolute inset-0 h-full w-full"
        count={320}
        sizeScale={0.8}
        maxAlpha={0.7}
        parallax={8}
      />
      <StarFieldCanvas
        className="absolute inset-0 h-full w-full"
        count={70}
        sizeScale={1.5}
        maxAlpha={0.95}
        parallax={22}
      />

      {/* 강한 그레인 — 이 테마의 주인공 */}
      <GrainOverlay baseFrequency={0.72} />
    </div>
  )
}
