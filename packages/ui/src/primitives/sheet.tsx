import { useId, useRef } from 'react'

import { usePresence } from '../a11y/use-presence.ts'
import { cx } from '../lib/cx.ts'
import { SHEET_GESTURE } from '../lib/sheet-geometry.ts'
import { useSheetResize } from '../lib/use-sheet-resize.ts'
import type { SheetOwnProps } from './types.ts'

export type SheetProps = SheetOwnProps

/**
 * The scrim-less surface. It renders no backdrop and traps no focus, so what it is about stays
 * visible and interactive around it — on a wide screen it takes the right edge, on a narrow one the
 * bottom. It is deliberately NOT a portal: as a child of its host it inherits that host's stacking,
 * and the running canvas beneath keeps every pointer it did not receive.
 *
 * Escape is not bound either: a surface with nothing dimmed behind it has no modal state to escape
 * from, and its host may be mid-commit — the close affordance is the one way out, and it can be
 * disabled.
 *
 * On the bottom-edge shape it wears a HANDLE, and the handle is about the argument the surface is
 * making: what this panel is for is watching the change land in the scene behind it, and on a phone
 * the panel is the half of the screen that scene was using. Dragging the handle hands height back and
 * takes it again, a tap collapses it and taps it back, and a pull that carries on past the short end
 * lets the sheet go — so a viewer can put it out of the way without giving up what they were in it for.
 * `closeDisabled` does not disable the drag: a save in flight is a reason not to CLOSE, not a reason
 * to make the sheet sit on top of the thing it is saving.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  closeLabel,
  closeDisabled = false,
  footer,
  children,
}: SheetProps) {
  const titleId = useId()
  const descriptionId = useId()
  // Held past the close so the surface can go back out the edge it came in from. A host that unmounts
  // the Sheet itself on close skips the leave — the element is gone before this can hold it.
  const { present, phase } = usePresence(open, SHEET_GESTURE.settleMs)
  const panelRef = useRef<HTMLElement | null>(null)
  const resize = useSheetResize(panelRef, onClose, !closeDisabled)

  if (!present) return null

  return (
    <section
      ref={panelRef}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : ariaLabel}
      aria-describedby={description ? descriptionId : undefined}
      // `h-[var(--sheet-height,auto)]`: the height the handle chose, and nothing at all until it has
      // chosen one. It is a class rather than an inline height so the `md:` rule can take it away —
      // the wide-screen shape is the right edge, top to bottom, and must not wear a phone's number.
      className={cx(
        'glass-strong pointer-events-auto fixed inset-x-0 bottom-0 z-[var(--z-overlay)] flex h-[var(--sheet-height,auto)] max-h-[70dvh] flex-col rounded-t-2xl px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] md:inset-y-0 md:left-auto md:right-0 md:h-auto md:max-h-none md:w-[22rem] md:rounded-l-2xl md:rounded-tr-none md:p-5',
        // A committed throw carries the sheet out itself, so the leave animation stands down rather
        // than fighting the transform for the same generated settle interval.
        resize.flung ? undefined : phase === 'leaving' ? 'sheet-leave' : 'sheet-enter',
      )}
      style={resize.style}
    >
      {/* The grab surface: the handle and the title row together, so the sheet answers to the whole
          top band rather than to a 4px pill. `touch-none` keeps the browser from reading a drag here
          as a page pan; the wide-screen shape has no gesture to reserve it for. The pill itself is
          `aria-hidden` — it is the drawing of a gesture, and everything the gesture does to a reader
          who cannot make it (getting the sheet out of the way, getting rid of it) it does to the
          scene, never to what is in the sheet. */}
      <div {...resize.handleProps} className="touch-none pt-1 md:touch-auto md:pt-0">
        <span
          aria-hidden="true"
          className="mx-auto mb-3 block h-1 w-10 rounded-full bg-border md:hidden"
        />
        <div className="flex items-start justify-between gap-4">
          {title ? (
            <h2 id={titleId} className="text-base font-semibold text-text">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            disabled={closeDisabled}
            className="rounded-md p-1 text-text-muted hover:text-text disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
      {footer ? <div className="mt-4 shrink-0">{footer}</div> : null}
    </section>
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
