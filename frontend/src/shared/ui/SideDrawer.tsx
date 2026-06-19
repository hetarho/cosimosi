import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

export interface SideDrawerProps {
  open: boolean
  /** Header title — also the dialog's accessible name. */
  title: string
  /** Dismiss the drawer (backdrop tap · ✕ · Esc all call this). */
  onClose: () => void
  children: ReactNode
}

/**
 * Right-anchored slide-in drawer over the persistent universe canvas (change 09) — the universe
 * shell's 햄버거 사이드바 (account / social / journal entry points). Canvas-outside DOM (헌법8).
 * Unlike the non-blocking Surface, the sidebar is a focused MENU: it dims the universe behind a
 * tap-to-close backdrop. Esc closes; the panel takes focus on open; prefers-reduced-motion drops
 * the slide to instant. No peek/snap — a plain drawer (lists use OverlayHost, results use Surface).
 */
export function SideDrawer({ open, title, onClose, children }: SideDrawerProps) {
  const reduce = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)

  // Esc closes (the page's single Esc router defers to opened surfaces; this owns its own Esc
  // so the drawer closes even when no page surface is up).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Move focus into the panel on open (keyboard users land inside the menu, not behind it).
  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.15 }}
        >
          {/* Tap-to-close dim. */}
          <button
            type="button"
            aria-label="사이드바 닫기"
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col border-l border-white/10 bg-black/70 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] backdrop-blur outline-none"
            initial={reduce ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduce ? { x: 0 } : { x: '100%' }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 36 }}
          >
            <header className="flex shrink-0 items-center justify-between px-4 py-4">
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
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 pb-4">
              {children}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
