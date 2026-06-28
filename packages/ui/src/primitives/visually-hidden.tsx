import type { VisuallyHiddenProps } from './types.ts'

export type { VisuallyHiddenProps }

/** Hide content visually while keeping it in the accessibility tree (backed by .cosimosi-sr-only in base.css). */
export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return <span className="cosimosi-sr-only">{children}</span>
}
