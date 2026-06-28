import { cx } from '../lib/cx.ts'

/** The shared busy spinner for Button / IconButton (decorative; the control carries aria-busy). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('size-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    />
  )
}
