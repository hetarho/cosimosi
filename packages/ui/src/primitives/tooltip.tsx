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
/**
 * Widest a wrapping tip may get, in px: a sentence's reading measure, not a paragraph's. It is a
 * number rather than a `max-w-*` class because the width is also bounded by the room the stated side
 * leaves — one `maxWidth` has to carry both, and the smaller of the two is the answer.
 */
const WRAP_MAX = 272
/** How close a wrapping tip may come to the viewport edge before it gives up width instead. */
const EDGE = 12

export function Tooltip({
  content,
  side = 'top',
  align = 'center',
  press = false,
  wrap = false,
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  // A tip a press opened is HELD: it is the content the reader came for, so it must not go away when
  // the pointer moves off the little control that opened it. A hovered one is not held, and leaving
  // takes it.
  const [held, setHeld] = useState(false)
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
    // A wrapping tip is capped by the room its stated side leaves, so it gives up WIDTH at a screen
    // edge rather than hanging off it — the tip stays where the caller put it, and only its measure
    // answers to the viewport. A single-line tip is left alone: it has no width to give up.
    const room = (available: number) => (wrap ? { maxWidth: Math.min(WRAP_MAX, available) } : null)
    if (side === 'left') {
      setPosition({
        right: viewportWidth - rect.left + GAP,
        top: rect.top + rect.height / 2,
        transform: 'translateY(-50%)',
        ...room(rect.left - GAP - EDGE),
      })
      return
    }
    const vertical =
      side === 'top' ? { bottom: viewportHeight - rect.top + GAP } : { top: rect.bottom + GAP }
    if (align === 'end') {
      setPosition({ ...vertical, right: viewportWidth - rect.right, ...room(rect.right - EDGE) })
      return
    }
    if (align === 'start') {
      setPosition({ ...vertical, left: rect.left, ...room(viewportWidth - rect.left - EDGE) })
      return
    }
    // Centred: the room is the smaller half doubled, since the tip grows both ways from the middle.
    const middle = rect.left + rect.width / 2
    setPosition({
      ...vertical,
      left: middle,
      transform: 'translateX(-50%)',
      ...room(2 * Math.min(middle - EDGE, viewportWidth - middle - EDGE)),
    })
  }, [side, align, wrap])

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

  // The two ways out a held tip needs and a hovered one never does: a press landing somewhere else,
  // and Escape. Escape is bound on the ANCHOR rather than the document and stopped there, because a
  // hint composed inside a `Dialog` sits under that dialog's focus trap, whose own Escape closes the
  // whole surface — dismissing the explanation must not dismiss what it was explaining. The anchor is
  // a descendant of the trap's node and holds the pressed trigger, so its listener runs first.
  useEffect(() => {
    const anchor = anchorRef.current
    if (!open || !held || !anchor) return
    const onPointerDown = (event: PointerEvent) => {
      if (anchor.contains(event.target as Node)) return
      setOpen(false)
      setHeld(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      setHeld(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    anchor.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      anchor.removeEventListener('keydown', onKeyDown)
    }
  }, [open, held])

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
      onMouseLeave={() => {
        if (!held) setOpen(false)
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => {
        setOpen(false)
        setHeld(false)
      }}
      // A press toggles the hold, which is why it is bound on pointerdown rather than on click: the
      // focus a press gives the trigger arrives in between and would only ever open, so a second
      // press on an already-held tip has to be read before it.
      onPointerDown={
        press
          ? () => {
              const holding = open && held
              setOpen(!holding)
              setHeld(!holding)
            }
          : undefined
      }
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
                'tooltip-surface pointer-events-none fixed z-[var(--z-tooltip)] rounded-lg px-2.5 py-1.5 text-sm text-text',
                wrap ? 'text-left' : 'whitespace-nowrap',
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
