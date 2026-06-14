import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export interface SidePanelProps {
  /** Header title shown above the scrollable body. */
  title: string
  /** Dismiss the panel entirely. */
  onClose: () => void
  children: ReactNode
}

/**
 * Desktop (fine pointer) overlay over the persistent universe canvas (spec 31, acceptance
 * 1.1/1.4) — a non-blocking left-side panel. Left (not right) to avoid the right-edge HUD
 * stack (camera/appearance controls + the bottom-right recall panel) and to match the diary
 * panel's established desktop placement (spec 28). NON-blocking: no backdrop, the universe
 * stays visible AND interactive behind it (1.3). Canvas-outside DOM (헌법8). Slides in from
 * the left; `prefers-reduced-motion` makes it instant (1.7).
 */
export function SidePanel({ title, onClose, children }: SidePanelProps) {
  const reduce = useReducedMotion()
  return (
    <motion.section
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className="absolute top-4 left-4 z-30 flex max-h-[calc(100dvh-2rem)] w-80 flex-col rounded-2xl border border-white/10 bg-black/60 backdrop-blur"
      initial={reduce ? false : { x: '-110%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
    >
      <header className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-sm font-medium text-white/80">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded-md px-2 text-white/50 transition hover:text-white/90"
        >
          ✕
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">{children}</div>
    </motion.section>
  )
}
