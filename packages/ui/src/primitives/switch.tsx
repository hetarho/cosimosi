import { useId, useState } from 'react'

import { cx } from '../lib/cx.ts'
import type { ToggleOwnProps } from './types.ts'

export type SwitchProps = ToggleOwnProps

export function Switch({ checked, defaultChecked, onCheckedChange, label, ariaLabel, disabled }: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const value = isControlled ? checked : internal
  const labelId = useId()

  const toggle = () => {
    if (disabled) return
    const next = !value
    if (!isControlled) setInternal(next)
    onCheckedChange?.(next)
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        disabled={disabled}
        onClick={toggle}
        className={cx(
          'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          'disabled:opacity-50 disabled:pointer-events-none',
          value ? 'bg-primary' : 'bg-surface-raised',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'inline-block size-5 rounded-full bg-text transition-transform',
            value ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
      {label ? (
        <span id={labelId} className="text-sm text-text">
          {label}
        </span>
      ) : null}
    </span>
  )
}
