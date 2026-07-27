import { useId } from 'react'

import { cx } from '../lib/cx.ts'
import type { ControlSize, FieldOwnProps, SelectOwnProps } from './types.ts'

export type SelectProps = FieldOwnProps & SelectOwnProps & { className?: string }

// A real <select>. The platform menu, keyboard interaction, type-ahead, mobile-web wheel and every
// assistive-tech affordance come free and correct; a div-with-listbox-role would re-implement all of it
// worse. What the design system contributes is the material — the same field well, sizes and invalid
// treatment TextField wears — so the two read as one family without the element being replaced.
const CONTROL_BASE =
  'field-surface w-full rounded-lg text-text transition ' +
  'disabled:opacity-50 disabled:pointer-events-none'

const CONTROL_SIZES: Record<ControlSize, string> = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-10 px-3 text-base',
  lg: 'h-12 px-3.5 text-lg',
}

export function Select({
  items,
  value,
  onValueChange,
  label,
  description,
  error,
  ariaLabel,
  disabled,
  size = 'md',
  className,
}: SelectProps) {
  const fieldId = useId()
  const descriptionId = description ? `${fieldId}-description` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  // One aria-describedby carrying both, in reading order — two attributes would let a reader hear only
  // the description and miss why the field is invalid.
  const describedBy = cx(descriptionId, errorId) || undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={fieldId} className="text-sm font-medium text-text">
          {label}
        </label>
      ) : null}
      <select
        id={fieldId}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(CONTROL_BASE, CONTROL_SIZES[size], className)}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {description ? (
        <p id={descriptionId} className="text-sm text-text-muted">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
