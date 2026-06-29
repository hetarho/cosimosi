import { cx } from '../lib/cx.ts'
import type { SkeletonOwnProps } from './types.ts'

export type SkeletonProps = SkeletonOwnProps

const ROUNDED: Record<NonNullable<SkeletonOwnProps['rounded']>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
}

export function Skeleton({ width, height, rounded = 'md' }: SkeletonProps) {
  // animate-pulse is neutralized by base.css under prefers-reduced-motion.
  return (
    <span
      aria-hidden="true"
      className={cx('block animate-pulse bg-surface-raised', ROUNDED[rounded])}
      style={{ width, height }}
    />
  )
}
