import { cx } from '../lib/cx.ts'
import type { ProgressOwnProps } from './types.ts'

export type ProgressProps = ProgressOwnProps

// The determinate meter. It reads `value`/`max` verbatim and clamps only for the geometry, so what a
// screen reader announces is exactly the pair the server sent — never a rounded percentage the visible
// number could contradict.
export function Progress({ value, max, ariaLabel }: ProgressProps) {
  // One bounded max for BOTH the geometry and the announcement: announcing a max the fill ignores
  // would have a full bar reporting 0 of 0.
  const boundedMax = Math.max(max, 0)
  const bounded = boundedMax === 0 ? 0 : Math.min(Math.max(value, 0), boundedMax)
  const ratio = boundedMax > 0 ? bounded / boundedMax : 1
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={boundedMax === 0 ? boundedMax : bounded}
      aria-valuemin={0}
      aria-valuemax={boundedMax}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
    >
      <div
        // Width is inline because it is data, not a style choice — there is no utility class for
        // "however far this user has got".
        className={cx('h-full rounded-full', ratio >= 1 ? 'bg-success' : 'bg-primary')}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}
