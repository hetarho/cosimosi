import { useId, type TextareaHTMLAttributes } from 'react'

import { cx } from '../lib/cx.ts'
import type { FieldOwnProps } from './types.ts'

export type TextAreaProps = Omit<FieldOwnProps, 'size'> & TextareaHTMLAttributes<HTMLTextAreaElement>

const CONTROL_BASE =
  'field-surface w-full min-h-24 rounded-lg px-3 py-2 text-base text-text placeholder:text-text-subtle transition ' +
  'disabled:opacity-50 disabled:pointer-events-none'

export function TextArea({ label, description, error, id, className, ...rest }: TextAreaProps) {
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
      <textarea
        id={fieldId}
        className={cx(CONTROL_BASE, className)}
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
