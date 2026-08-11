import { useRef, type CSSProperties, type KeyboardEvent } from 'react'

import { cx } from '../lib/cx.ts'
import type { SegmentedControlOwnProps } from './types.ts'

export type SegmentedControlProps = SegmentedControlOwnProps

// A bounded choice whose options all stay visible. It is a RADIOGROUP, not a tablist: the segments
// select a value, they do not swap a panel — so nothing here carries aria-controls, and a reader
// hears "1 of 2 selected" rather than a tab position.
export function SegmentedControl({
  items,
  value,
  onValueChange,
  ariaLabel,
  disabled = false,
}: SegmentedControlProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>())

  // A value outside the set is a caller bug, but it must not strand the keyboard: the first segment
  // stands in as the focus anchor so the group keeps one tab stop and the arrows still walk it.
  const selectedIndex = items.findIndex((item) => item.value === value)
  const anchorIndex = selectedIndex === -1 ? 0 : selectedIndex

  const move = (event: KeyboardEvent<HTMLButtonElement>, direction: -1 | 1) => {
    if (disabled) return
    event.preventDefault()
    const nextIndex = (anchorIndex + direction + items.length) % items.length
    const next = items[nextIndex]
    if (!next) return
    onValueChange(next.value)
    refs.current.get(next.value)?.focus()
  }

  return (
    // The thumb is an `aria-hidden` sibling of the radios, never a wrapper around them: putting an
    // element between the radiogroup and its radios breaks the ownership some assistive tech reads.
    // Its position is a custom property rather than a class per index, so the group carries one
    // number and the CSS does the arithmetic.
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      // `inline-grid` with equal auto columns is what actually makes the segments the same width,
      // which is what lets the thumb be one translate with nothing measured. Flex cannot do it here:
      // a flex item's automatic minimum is its own content, and a shrink-to-fit container has no
      // free space left for `flex-grow` to even out — the segments keep their label widths and the
      // thumb lands beside the one it is meant to be under.
      className="relative inline-grid auto-cols-fr grid-flow-col rounded-xl border border-border bg-surface p-1"
      style={
        {
          '--segment-count': items.length,
          '--segment-index': anchorIndex,
        } as CSSProperties
      }
    >
      {/* Hidden when the value is outside the set: `aria-checked` is false on every segment then, and
          a thumb sitting under the first one would tell the eye a selection the reader is not. */}
      {selectedIndex !== -1 && <span aria-hidden className="segment-thumb" />}
      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) refs.current.set(item.value, node)
              else refs.current.delete(item.value)
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            // Roving focus: only the selected segment is tabbable, so the group is one tab stop and
            // the arrow keys move within it.
            tabIndex={index === anchorIndex ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(event, -1)
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(event, 1)
            }}
            className={cx(
              // `relative` lifts the label above the thumb sliding beneath it; the equal widths come
              // from the group's grid columns.
              'relative rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50',
              selected ? 'text-text' : 'text-text-muted hover:text-text',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
