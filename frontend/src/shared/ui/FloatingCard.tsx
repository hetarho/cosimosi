import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const WIDTH = {
  sm: 'w-88',
  md: 'w-96',
  lg: 'w-160',
} as const

/** Corner-independent anchors (CSS top/left only — the −50% shift is a motion transform so it
 *  composes with the pop scale instead of being clobbered by Tailwind's translate utilities). */
const ANCHOR = {
  top: 'top-[calc(1rem+env(safe-area-inset-top))] left-1/2',
  center: 'top-1/2 left-1/2',
} as const

export interface FloatingCardProps {
  /** Header title — also the dialog's accessible name. */
  title: string
  /** Dismiss the card entirely. */
  onClose: () => void
  /** Card width on desktop (sm 22rem · md 24rem · lg 40rem), all capped to 92vw. */
  width?: keyof typeof WIDTH
  /** Corner-independent placement: `top` (centered, near top — for recall/lists so the focused
   *  star below stays visible) or `center` (deep dialogs: evolution/share/gift/send). */
  place?: keyof typeof ANCHOR
  children: ReactNode
}

/**
 * Desktop (fine pointer) result surface over the persistent universe canvas (spec 31, home-ia
 * revamp) — a NON-BLOCKING floating card, corner-independent (centered top or center), replacing
 * the old left-pinned SidePanel. The universe stays visible AND interactive behind it (no
 * backdrop — 1.3). Canvas-outside DOM (헌법8). Pops with scale/opacity; the −50% centering is a
 * motion transform (x/y) so it doesn't fight the scale; prefers-reduced-motion makes it instant (1.7).
 * Surface renders it on fine pointers, so every result wears one idiom.
 */
export function FloatingCard({ title, onClose, width = 'md', place = 'top', children }: FloatingCardProps) {
  const reduce = useReducedMotion()
  // Centering offset as a motion transform (constant — only scale/opacity animate), so it
  // composes with the pop instead of Tailwind `-translate-*` clobbering motion's transform.
  const off = place === 'center' ? { x: '-50%', y: '-50%' } : { x: '-50%' }
  return (
    <motion.section
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className={`absolute z-30 flex max-h-[calc(100dvh-2rem)] max-w-[92vw] flex-col rounded-2xl border border-white/10 bg-black/60 backdrop-blur ${WIDTH[width]} ${ANCHOR[place]}`}
      initial={reduce ? false : { ...off, opacity: 0, scale: 0.96 }}
      animate={{ ...off, opacity: 1, scale: 1 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 340, damping: 30 }}
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
      {/* min-h-0 + overflow so a long body scrolls inside the card; a content list with its own
          flex-1 overflow nests safely (it fills exactly, so this rarely double-scrolls). */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
        {children}
      </div>
    </motion.section>
  )
}
