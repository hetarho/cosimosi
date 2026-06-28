import { useEffect, useRef } from 'react'

import { cx } from '../lib/cx.ts'
import type { ToastOwnProps, ToastVariant } from './types.ts'

export type ToastProps = ToastOwnProps

const ROLE: Record<ToastVariant, 'status' | 'alert'> = {
  info: 'status',
  success: 'status',
  warning: 'alert',
  danger: 'alert',
}

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

  if (!open) return null

  return (
    <div
      role={ROLE[variant]}
      aria-live={variant === 'warning' || variant === 'danger' ? 'assertive' : 'polite'}
      className={cx(
        'rounded-md border bg-surface-raised px-4 py-3 text-sm text-text shadow-md transition-opacity',
        TONE[variant],
      )}
    >
      {children}
    </div>
  )
}
