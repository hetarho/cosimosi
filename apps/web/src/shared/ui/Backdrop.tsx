import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib'

export interface BackdropProps {
  /** Click-to-dismiss handler. If omitted the layer is **visual only** (pointer-events: none),
   *  so the universe behind stays tappable (an empty-space tap is handled by the canvas's
   *  onPointerMissed instead) — used for the in-universe focus dim (별 회상·일기 조망). When
   *  provided, the layer captures the click and dismisses — used behind list/menu overlays. */
  onDismiss?: () => void
  /** Position/z utility classes — the host decides the layer (focus dim z-10, list backdrop z-20). */
  className?: string
}

/**
 * 은은한 딤 레이어 (spec 31 모바일 하드닝) — 포커스/오버레이 상태를 시각적으로 알리고, 배경 탭으로
 * 빠져나오는 동선을 만든다. 별은 또렷이 보이도록 약하게만 어둡힌다(bloom 별은 딤 위로 뜬다).
 * reduced-motion이면 페이드 없이 즉시.
 */
export function Backdrop({ onDismiss, className }: BackdropProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      aria-hidden
      onClick={onDismiss}
      className={cn('absolute inset-0 bg-black/30', onDismiss ? '' : 'pointer-events-none', className)}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
    />
  )
}
