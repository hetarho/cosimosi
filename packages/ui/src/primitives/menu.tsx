import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react'

import { cx } from '../lib/cx.ts'
import type { MenuOwnProps } from './types.ts'

export type MenuProps = MenuOwnProps

// Placement is stated, never measured — the same stance `Tooltip` takes. A menu is wider than the
// icon that opens it, so the composition site is the only place that knows which way there is room.
const SIDE = {
  top: 'bottom-full mb-1.5',
  bottom: 'top-full mt-1.5',
} as const

const ALIGN = {
  start: 'left-0',
  end: 'right-0',
} as const

const ITEM_TONE = {
  neutral: 'text-text hover:bg-surface',
  danger: 'text-danger hover:bg-surface',
} as const

/**
 * A short list of commands behind one control.
 *
 * The list is the caller's — this owns only whether it is showing, where the keyboard is inside it,
 * and the three ways out (a choice, Escape, a press elsewhere). Every item closes the menu before it
 * acts, because a command that opens another surface must not leave this one hanging over it.
 *
 * Escape is stopped inside the list rather than allowed to bubble: a `Menu` composed inside a
 * `Dialog` sits under that dialog's focus trap, whose own Escape closes the whole surface, and
 * dismissing the list must not dismiss the panel the list belongs to. That is also why the keys are
 * bound with a NATIVE listener on the panel instead of React's `onKeyDown` — React delegates from
 * the tree's root, so the trap's own listener on an ancestor node would already have run and closed
 * the dialog by the time a synthetic handler could stop anything.
 */
export function Menu({ items, trigger, ariaLabel, side = 'bottom', align = 'end' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Every way out puts the keyboard back on the trigger, because the item holding focus is about to
  // stop existing: whatever the list closes on — a choice or Escape — focus would otherwise land on
  // the document body, outside any focus trap the composing surface has armed.
  const close = useCallback(() => {
    setOpen(false)
    wrapperRef.current?.querySelector('button')?.focus()
  }, [])

  // Opening moves the keyboard into the list and arms the two ways out that are not a choice:
  // Escape, and a press landing anywhere else. Both are bound only while the list is showing, so a
  // closed menu costs no listener.
  useEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return

    // The rendered buttons minus the disabled ones, which cannot hold focus.
    const reachable = () =>
      itemRefs.current.filter((item): item is HTMLButtonElement => item !== null && !item.disabled)
    const focusAt = (index: number) => {
      const items = reachable()
      if (items.length === 0) return
      items[((index % items.length) + items.length) % items.length]?.focus()
    }
    focusAt(0)

    const onKeyDown = (event: KeyboardEvent) => {
      const current = reachable().findIndex((item) => item === document.activeElement)
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusAt(current + 1)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusAt(current - 1)
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        focusAt(0)
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        focusAt(reachable().length - 1)
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    panel.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      panel.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, close])

  const triggerControl = isValidElement(trigger)
    ? cloneElement(
        trigger as ReactElement<{
          'aria-haspopup'?: 'menu'
          'aria-expanded'?: boolean
          'aria-controls'?: string
          onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void
        }>,
        {
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          'aria-controls': open ? menuId : undefined,
          onClick: () => setOpen((showing) => !showing),
        },
      )
    : trigger

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      {triggerControl}
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          id={menuId}
          aria-label={ariaLabel}
          className={cx(
            'glass-strong absolute z-[var(--z-dropdown)] flex min-w-44 flex-col rounded-xl p-1',
            SIDE[side],
            ALIGN[align],
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.value}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                close()
                item.onSelect()
              }}
              className={cx(
                'rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                'disabled:pointer-events-none disabled:opacity-50',
                ITEM_TONE[item.tone ?? 'neutral'],
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  )
}
