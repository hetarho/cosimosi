import { useRef, type KeyboardEvent } from 'react'

import { cx } from '../lib/cx.ts'
import type { TabsOwnProps } from './types.ts'

export type TabsProps = TabsOwnProps

export function Tabs({ items, value, onValueChange, ariaLabel }: TabsProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>())

  const move = (event: KeyboardEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.preventDefault()
    const currentIndex = items.findIndex((item) => item.value === value)
    const nextIndex = (currentIndex + direction + items.length) % items.length
    const next = items[nextIndex]
    if (!next) return
    onValueChange(next.value)
    refs.current.get(next.value)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1"
    >
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) refs.current.set(item.value, node)
              else refs.current.delete(item.value)
            }}
            type="button"
            role="tab"
            id={`${item.panelId}-tab`}
            aria-selected={selected}
            aria-controls={item.panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') move(event, -1)
              if (event.key === 'ArrowRight') move(event, 1)
              if (event.key === 'Home') {
                event.preventDefault()
                const first = items[0]
                if (first) {
                  onValueChange(first.value)
                  refs.current.get(first.value)?.focus()
                }
              }
              if (event.key === 'End') {
                event.preventDefault()
                const last = items.at(-1)
                if (last) {
                  onValueChange(last.value)
                  refs.current.get(last.value)?.focus()
                }
              }
            }}
            className={cx(
              'shrink-0 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              selected ? 'bg-background text-text shadow-sm' : 'text-text-muted hover:text-text',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
