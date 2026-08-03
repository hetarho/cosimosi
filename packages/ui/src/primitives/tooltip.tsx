import { cloneElement, isValidElement, useId, useState, type ReactElement } from 'react'

import { cx } from '../lib/cx.ts'
import type { TooltipOwnProps } from './types.ts'

export type TooltipProps = TooltipOwnProps

// Placement is the caller's to state, not something measured here: a tip is wider and taller than
// the control it names, so a control against an edge of the screen has exactly one direction its tip
// can go, and the composition site is where that is known. `top` + `center` is the default and the
// common case; the rest exist because a HUD puts controls in the corners.
const SIDE = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
} as const

// Along the shared horizontal edge — so it says nothing about a tip placed to the `left`, which has
// no such edge and centres on the trigger's height instead.
const ALIGN = {
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
} as const

export function Tooltip({ content, side = 'top', align = 'center', children }: TooltipProps) {
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
          className={cx(
            'tooltip-surface absolute z-[var(--z-tooltip)] whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-text',
            SIDE[side],
            side !== 'left' && ALIGN[align],
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}
