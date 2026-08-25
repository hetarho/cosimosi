import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import { useFocusTrap } from '../a11y/use-focus-trap.ts'
import { usePresence } from '../a11y/use-presence.ts'
import { cx } from '../lib/cx.ts'
import { SHEET_GESTURE } from '../lib/sheet-geometry.ts'
import { SURFACE_PANEL_ATTR } from '../lib/sheet-shape.ts'
import { useSheetDrag } from '../lib/use-sheet-drag.ts'
import type { DialogOwnProps } from './types.ts'

export type DialogProps = DialogOwnProps

/**
 * The surface that interrupts, in whichever shape the screen has room for: a centred modal on a wide
 * one, a bottom sheet on a narrow one — where a centred box has neither the width to hold a real
 * panel nor the reach of a thumb. Both wear the same scrim, the same focus trap and the same
 * Escape, because what the breakpoint changes is where the surface sits, not what it promises. The
 * sheet adds one way out the modal has no use for: a swipe back down the edge it came in from.
 *
 * The scrim-less alternative, for a surface that must NOT interrupt, is `Sheet` — the two are
 * different promises, not two settings.
 */
export function Dialog({ open, ...rest }: DialogProps) {
  // Held one animation past the close so the surface can go back out the way it came in. The body
  // below mounts only while it is on screen, which is also what resets the swipe between openings.
  const { present, phase } = usePresence(open, SHEET_GESTURE.settleMs)

  if (!present || typeof document === 'undefined') return null

  return createPortal(
    <DialogSurface open={open} leaving={phase === 'leaving'} {...rest} />,
    document.body,
  )
}

function DialogSurface({
  open,
  leaving,
  onClose,
  title,
  description,
  ariaLabel,
  closeLabel,
  children,
}: Omit<DialogProps, 'open'> & { open: boolean; leaving: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const drag = useSheetDrag(onClose)

  useFocusTrap(containerRef, { active: open, onEscape: onClose })

  return (
    // `pointer-events-auto`: a modal is reachable wherever it is composed, including inside a
    // non-interactive HUD layer, whose `pointer-events: none` would otherwise inherit down and leave
    // the scrim and every control in here inert.
    <div className="pointer-events-auto fixed inset-0 z-[var(--z-modal)] flex items-end justify-center md:items-center">
      <div
        className={cx('absolute inset-0 bg-overlay', leaving ? 'scrim-leave' : 'scrim-enter')}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        // Marks the panel for chrome painting above the modal layer, which has to measure what it
        // must not lie across (sheet-shape.ts).
        {...{ [SURFACE_PANEL_ATTR]: '' }}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        // The panel is bounded by the viewport and scrolls its own body: a dialog that composes a
        // real editing surface can outgrow the screen, and a surface that interrupts must never
        // push its actions past the bottom edge. The header stays put; only the body scrolls.
        // Base is the sheet — full width on the bottom edge — and the `md:` half is the centred
        // modal, whose own `md:p-6` wins there: a modal held off the viewport by its margin has no
        // bottom edge to clear.
        //
        // The sheet's bottom padding ADDS to the home-indicator inset rather than competing with it
        // (`calc`, not `max`): the two answer different questions — the inset says where the device
        // stops being touchable, the padding says how much room the last control needs above that —
        // and a `max()` lets a tall inset silently eat the whole gap, seating the actions flush
        // against the indicator on exactly the phones that needed the room most.
        className={cx(
          'glass-strong relative z-10 flex w-full max-h-[85dvh] flex-col rounded-t-2xl px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+2.5rem)]',
          'md:m-4 md:max-h-[calc(100dvh-2rem)] md:max-w-md md:rounded-2xl md:p-6',
          'focus-visible:outline-none',
          // A committed swipe carries the sheet out itself, so the leave animation stands down
          // rather than fighting the transform for the same generated settle interval.
          drag.flung ? undefined : leaving ? 'dialog-leave' : 'dialog-enter',
        )}
        style={drag.style}
      >
        {/* The grab surface: the handle and the title row together, so the sheet answers to the
            whole top band rather than to a 4px pill. `touch-none` keeps the browser from reading a
            downward drag here as a page pan; the modal above `md` has no gesture to reserve it for. */}
        <div {...drag.handleProps} className="touch-none md:touch-auto">
          <span
            aria-hidden="true"
            className="mx-auto mb-3 block h-1 w-10 rounded-full bg-border md:hidden"
          />
          <div className="flex items-start justify-between gap-4">
            {title ? (
              <h2 id={titleId} className="text-lg font-semibold text-text">
                {title}
              </h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
              className="rounded-md p-1 text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <CloseIcon />
            </button>
          </div>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm text-text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto text-text">{children}</div>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  )
}
