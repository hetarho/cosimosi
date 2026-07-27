import type { HTMLAttributes } from 'react'

import { cx } from '../lib/cx.ts'
import type { AlertOwnProps, AlertVariant } from './types.ts'

export type AlertProps = AlertOwnProps & HTMLAttributes<HTMLDivElement>

// The inline alert: one row that stays on the surface after a toast has gone. The recipe (rim,
// whisper of fill, plain ink) lives in base.css `.alert*`; only geometry and type are utilities here.
const BASE = 'rounded-lg px-3 py-2 text-sm leading-6'

const VARIANTS: Record<AlertVariant, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  danger: 'alert-danger',
}

export function Alert({
  variant = 'danger',
  live = 'alert',
  children,
  className,
  ...rest
}: AlertProps) {
  return (
    <div role={live} className={cx('alert', BASE, VARIANTS[variant], className)} {...rest}>
      {children}
    </div>
  )
}
