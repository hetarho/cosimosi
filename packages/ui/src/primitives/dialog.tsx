import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import { useFocusTrap } from '../a11y/use-focus-trap.ts'
import type { DialogOwnProps } from './types.ts'

export type DialogProps = DialogOwnProps

export function Dialog({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  closeLabel,
  children,
}: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useFocusTrap(containerRef, { active: open, onEscape: onClose })

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center">
      <div className="absolute inset-0 bg-overlay" aria-hidden="true" onClick={onClose} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="glass-strong relative z-10 m-4 w-full max-w-md rounded-2xl p-6 focus-visible:outline-none"
      >
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
        <div className="mt-4 text-text">{children}</div>
      </div>
    </div>,
    document.body,
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
