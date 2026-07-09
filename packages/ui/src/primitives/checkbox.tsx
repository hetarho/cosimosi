import { cx } from '../lib/cx.ts'
import type { ToggleOwnProps } from './types.ts'

export type CheckboxProps = ToggleOwnProps

export function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  label,
  ariaLabel,
  disabled,
}: CheckboxProps) {
  const controlled =
    checked !== undefined ? { checked } : { defaultChecked: defaultChecked ?? false }

  return (
    <label className={cx('inline-flex items-center gap-2', disabled && 'opacity-50')}>
      <input
        type="checkbox"
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className="checkbox focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        {...controlled}
      />
      {label ? <span className="text-sm text-text">{label}</span> : null}
    </label>
  )
}
