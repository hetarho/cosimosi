import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'

import { cx } from '../lib/cx.ts'
import type { TooltipOwnProps } from './types.ts'

export type TooltipProps = TooltipOwnProps

/** The gap between the trigger and the tip, in px — the `mt-2` the tip used to carry itself. */
const GAP = 8

export function Tooltip({ content, side = 'top', align = 'center', children }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  // Direction stays the CALLER's to state — nothing here flips a side or hunts for room. Measuring
  // is only how a stated side becomes pixels once the tip no longer lives beside its trigger.
  const place = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    // The viewport a `fixed` box is laid out in EXCLUDES the classic scrollbar, which `window.inner*`
    // counts — reading those would push every right/bottom-anchored tip inward by the scrollbar's
    // width on any page long enough to scroll.
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight
    if (side === 'left') {
      setPosition({
        right: viewportWidth - rect.left + GAP,
        top: rect.top + rect.height / 2,
        transform: 'translateY(-50%)',
      })
      return
    }
    const vertical =
      side === 'top' ? { bottom: viewportHeight - rect.top + GAP } : { top: rect.bottom + GAP }
    setPosition(
      align === 'end'
        ? { ...vertical, right: viewportWidth - rect.right }
        : { ...vertical, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' },
    )
  }, [side, align])

  useLayoutEffect(() => {
    if (!open) return
    place()
  }, [open, place])

  // A tip pinned to the viewport has to follow its trigger, and the trigger may sit in a list that
  // scrolls under it. `capture` catches scrolls on any ancestor, not just the document.
  useEffect(() => {
    if (!open) return
    const follow = () => place()
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [open, place])

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
      ref={anchorRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {trigger}
      {/* Portalled to the document, like every other overlay in this package. A tip is the smallest
          thing on screen and the last thing that should lose a paint-order argument: rendered beside
          its trigger it is sealed inside whatever stacking context an ancestor happens to create —
          and this product's chrome is built out of exactly those (glass is a backdrop-filter, a lit
          label is a filter), so any z-index it carried would only sort it against its own siblings. */}
      {open && position && typeof document !== 'undefined'
        ? createPortal(
            <span
              role="tooltip"
              id={tooltipId}
              style={position}
              className={cx(
                'tooltip-surface pointer-events-none fixed z-[var(--z-tooltip)] whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-text',
              )}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}
