import { VALUES } from '@cosimosi/config'
import type { SequenceRect } from '@cosimosi/sequence'
import { cx, useReducedMotion } from '@cosimosi/ui'

// features/highlight-next-control ui ([O2]): a ring drawn over the measured rect of the control the
// current step names. Non-modal by construction — `pointer-events: none` and `aria-hidden`, no
// backdrop, nothing disabled — so the screen underneath stays fully operable INCLUDING the controls
// this step does not name. A mis-tap is simply not progress, never a blocked interaction, and the
// real control keeps its own focus and semantics because nothing here is able to take them.
//
// It renders nothing when the anchor could not be measured: the caption is the guaranteed channel and
// the highlight is an enhancement, so an unresolved anchor is not an error state to surface.
export function SequenceSpotlight({ rect }: { rect: SequenceRect | null }) {
  const reducedMotion = useReducedMotion()
  if (!rect) return null

  return (
    <div
      aria-hidden
      className={cx(
        'pointer-events-none fixed z-40 rounded-xl border-2 border-primary',
        !reducedMotion && 'animate-pulse',
      )}
      style={{
        // Rects arrive in logical pixels relative to the app window — the same units on both
        // platforms — which is why a fixed-position box can consume them directly.
        left: rect.x - RING_PADDING_PX,
        top: rect.y - RING_PADDING_PX,
        width: rect.width + RING_PADDING_PX * 2,
        height: rect.height + RING_PADDING_PX * 2,
        // Overrides the shared `animate-pulse` period only; inline longhand wins over the utility's
        // shorthand. Under reduced motion the class is gone and the ring simply holds still — the
        // pulse draws the eye, but the ring is what actually says "here".
        animationDuration: reducedMotion ? undefined : `${VALUES.sequence.highlightPulseMs}ms`,
      }}
    />
  )
}

// Slice-local geometry: how far the ring stands off the control it circles. Visual language, not a
// tuning value ([09] / [56]) — it belongs to this chrome and to nothing else.
const RING_PADDING_PX = 8
