import { type ReactNode } from 'react'
import { BottomSheet } from './BottomSheet'
import { FloatingCard, type FloatingCardProps } from './FloatingCard'
import { useCoarsePointer } from './use-coarse-pointer'

export interface SurfaceProps {
  /** Whether the surface is mounted/visible. */
  open: boolean
  /** Header title — also the dialog's accessible name. */
  title: string
  /** Dismiss the surface entirely. */
  onClose: () => void
  /** Floating-card width on desktop (mobile is always a full-width sheet). */
  width?: FloatingCardProps['width']
  /** Floating-card placement on desktop (corner-independent). */
  place?: FloatingCardProps['place']
  children: ReactNode
}

/**
 * The single NON-BLOCKING result host (home-ia revamp) — one idiom for every result/action
 * surface: recall, evolution, share, gift, send, compose. Coarse pointer → BottomSheet, fine →
 * FloatingCard (헌법4 — 플랫폼 분기는 ui 레이어). No peek and no backdrop: the universe stays visible AND interactive behind it (A7), and there is
 * NO `fixed inset-0` blocking modal (A4 — the share/gift/send modals fold into this). Esc/empty-tap
 * dismissal is owned by the page (focusActor / page state), not here, to keep one Esc router.
 * Each feature provides body-only CONTENT; this host (via BottomSheet/FloatingCard) owns the
 * container, header, scroll, safe-area and reduced-motion.
 */
export function Surface({ open, title, onClose, width, place, children }: SurfaceProps) {
  const coarse = useCoarsePointer()
  if (!open) return null
  return coarse ? (
    <BottomSheet title={title} onClose={onClose}>
      {children}
    </BottomSheet>
  ) : (
    <FloatingCard title={title} onClose={onClose} width={width} place={place}>
      {children}
    </FloatingCard>
  )
}
