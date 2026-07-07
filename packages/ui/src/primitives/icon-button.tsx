import type { ButtonHTMLAttributes } from 'react'

import { cx } from '../lib/cx.ts'
import { BUTTON_VARIANTS, FOCUS_RING } from './button-styles.ts'
import { Spinner } from './spinner.tsx'
import type { ControlSize, IconButtonOwnProps } from './types.ts'

export type IconButtonProps = IconButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'>

const BASE =
  'inline-flex items-center justify-center rounded-md transition select-none ' +
  `${FOCUS_RING} disabled:opacity-50 disabled:pointer-events-none`

const SIZES: Record<ControlSize, string> = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled,
  label,
  icon,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(BASE, BUTTON_VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : <span aria-hidden="true">{icon}</span>}
    </button>
  )
}
