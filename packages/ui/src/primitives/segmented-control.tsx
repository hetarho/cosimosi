import { useRef, type CSSProperties, type KeyboardEvent } from 'react'

import { cx } from '../lib/cx.ts'
import type { SegmentedControlOwnProps } from './types.ts'

export type SegmentedControlProps = SegmentedControlOwnProps

// The track both shapes wear. `inline-grid` with equal auto columns is what actually makes the
// segments the same width, which is what lets the thumb be one translate with nothing measured. Flex
// cannot do it here: a flex item's automatic minimum is its own content, and a shrink-to-fit
// container has no free space left for `flex-grow` to even out — the segments keep their label widths
// and the thumb lands beside the one it is meant to be under.
const TRACK =
  'relative inline-grid auto-cols-fr grid-flow-col rounded-xl border border-border bg-surface p-1'

const LABEL =
  // `relative` lifts the label above the thumb sliding beneath it; the equal widths come from the
  // track's grid columns.
  'relative rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors'

// A bounded choice whose options all stay visible. It is a RADIOGROUP, not a tablist: the segments
// select a value, they do not swap a panel — so nothing here carries aria-controls, and a reader
// hears "1 of 2 selected" rather than a tab position.
//
// `toggle` is the SECOND shape, for a choice between exactly two: the same track and the same
// sliding thumb, but ONE control rather than two, so a press lands on the other option wherever on
// it the press falls. It stops being a radiogroup there and becomes a switch, because that is what
// it now is — a press on the option already held changes the value, which is the one thing a radio
// must never do. Its accessible name carries the option currently held, so the state a reader hears
// is the label they can see rather than a bare on/off whose polarity they would have to guess.
export function SegmentedControl({
  items,
  value,
  onValueChange,
  ariaLabel,
  disabled = false,
  toggle = false,
}: SegmentedControlProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>())

  // A value outside the set is a caller bug, but it must not strand the keyboard: the first segment
  // stands in as the focus anchor so the group keeps one tab stop and the arrows still walk it.
  const selectedIndex = items.findIndex((item) => item.value === value)
  const anchorIndex = selectedIndex === -1 ? 0 : selectedIndex

  const [first, second] = items
  if (toggle && first && second && items.length === 2) {
    const held = selectedIndex === -1 ? undefined : items[selectedIndex]
    const other = selectedIndex === 1 ? first : second
    return (
      <button
        type="button"
        role="switch"
        aria-checked={selectedIndex === 1}
        aria-label={held ? `${ariaLabel}: ${held.label}` : ariaLabel}
        disabled={disabled}
        onClick={() => onValueChange(other.value)}
        className={cx(
          TRACK,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50',
        )}
        style={
          {
            '--segment-count': items.length,
            '--segment-index': anchorIndex,
          } as CSSProperties
        }
      >
        {selectedIndex !== -1 && <span aria-hidden className="segment-thumb" />}
        {items.map((item) => (
          // The labels are the switch's two states, not two controls: the button above owns the
          // press and the name, so these are ink only.
          <span
            key={item.value}
            aria-hidden
            className={cx(LABEL, item.value === value ? 'text-text' : 'text-text-muted')}
          >
            {item.label}
          </span>
        ))}
      </button>
    )
  }

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
      className={TRACK}
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
              LABEL,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50',
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
