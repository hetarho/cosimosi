import { cx } from '../lib/cx.ts'
import type { BadgeOwnProps, BadgeVariant } from './types.ts'

export type BadgeProps = BadgeOwnProps

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-raised text-text-muted',
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  danger: 'bg-danger text-danger-foreground',
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', VARIANTS[variant])}>
      {children}
    </span>
  )
}
