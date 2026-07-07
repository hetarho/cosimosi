import { cloneElement, isValidElement, useId, useState, type ReactElement } from 'react'

import type { TooltipOwnProps } from './types.ts'

export type TooltipProps = TooltipOwnProps

export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()

  // aria-describedby must sit on the focusable trigger itself, not a wrapper, or a
  // screen reader won't announce the tip when the trigger gains focus. Clone the
  // child to add it (only when an element is given); event handlers stay on the
  // wrapper, where focus/blur bubble from the child.
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': open ? tooltipId : undefined,
      })
    : children

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {trigger}
      {open ? (
        <span
          role="tooltip"
          id={tooltipId}
          className="glass-strong absolute bottom-full left-1/2 z-[var(--z-tooltip)] mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-text"
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}
