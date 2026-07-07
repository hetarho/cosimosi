import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { cx } from '../lib/cx.ts'
import type { ToastOwnProps, ToastVariant } from './types.ts'

export type ToastProps = ToastOwnProps

const ROLE: Record<ToastVariant, 'status' | 'alert'> = {
  info: 'status',
  success: 'status',
  warning: 'alert',
  danger: 'alert',
}

// Variant accent lives on the border (matches the outline-first language), over the glass surface.
const TONE: Record<ToastVariant, string> = {
  info: 'border-border',
  success: 'border-success',
  warning: 'border-warning',
  danger: 'border-danger',
}

export function Toast({ open, onOpenChange, variant = 'info', durationMs, children }: ToastProps) {
  // Keep the latest close callback in a ref so an inline handler doesn't restart
  // the auto-dismiss timer on every parent render.
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  useEffect(() => {
    if (!open || !durationMs) return
    const timer = setTimeout(() => onOpenChangeRef.current(false), durationMs)
    return () => clearTimeout(timer)
  }, [open, durationMs])

  if (!open || typeof document === 'undefined') return null

  // Float in a fixed viewport (bottom-centre on small screens, bottom-right on wider) via a portal,
  // so a Toast behaves like a toast wherever it is placed in the tree rather than sitting inline.
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-toast)] flex flex-col items-center gap-2 p-4 sm:items-end">
      <div
        role={ROLE[variant]}
        aria-live={variant === 'warning' || variant === 'danger' ? 'assertive' : 'polite'}
        className={cx('toast-surface pointer-events-auto rounded-xl px-4 py-3 text-sm', TONE[variant])}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
