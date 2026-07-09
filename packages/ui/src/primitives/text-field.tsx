import { useId, type InputHTMLAttributes } from 'react'

import { cx } from '../lib/cx.ts'
import type { ControlSize, FieldOwnProps } from './types.ts'

export type TextFieldProps = FieldOwnProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>

const CONTROL_BASE =
  'field-surface w-full rounded-lg text-text placeholder:text-text-subtle transition ' +
  'disabled:opacity-50 disabled:pointer-events-none'

const CONTROL_SIZES: Record<ControlSize, string> = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-10 px-3 text-base',
  lg: 'h-12 px-3.5 text-lg',
}

export function TextField({
  label,
  description,
  error,
  size = 'md',
  id,
  className,
  ...rest
}: TextFieldProps) {
  const reactId = useId()
  const fieldId = id ?? reactId
  const descriptionId = description ? `${fieldId}-description` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = cx(descriptionId, errorId) || undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={fieldId} className="text-sm font-medium text-text">
          {label}
        </label>
      ) : null}
      <input
        id={fieldId}
        className={cx(CONTROL_BASE, CONTROL_SIZES[size], className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
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
