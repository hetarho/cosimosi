import { cx } from '../lib/cx.ts'
import type { BadgeOwnProps, BadgeVariant } from './types.ts'

export type BadgeProps = BadgeOwnProps

// Outline-first glass chips: colour lives on the rim + text (+ optional .badge-dot), not a solid
// fill. The recipe (geometry, material, per-variant colour) lives in base.css `.badge*`.
const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'badge-neutral',
  primary: 'badge-primary',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={cx('badge', VARIANTS[variant])}>{children}</span>
}
