import { useId } from 'react'

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

  if (!open) return null

  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : ariaLabel}
      aria-describedby={description ? descriptionId : undefined}
      className="glass-strong pointer-events-auto fixed inset-x-0 bottom-0 z-[var(--z-overlay)] flex max-h-[70dvh] flex-col rounded-t-2xl p-5 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[22rem] md:rounded-l-2xl md:rounded-tr-none"
    >
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
