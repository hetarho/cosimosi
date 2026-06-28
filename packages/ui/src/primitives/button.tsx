import type { ButtonHTMLAttributes } from 'react'

import { cx } from '../lib/cx.ts'
import { BUTTON_VARIANTS, FOCUS_RING } from './button-styles.ts'
import { Spinner } from './spinner.tsx'
import type { ButtonOwnProps, ControlSize } from './types.ts'

export type ButtonProps = ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors select-none ' +
  `${FOCUS_RING} disabled:opacity-50 disabled:pointer-events-none`

const SIZES: Record<ControlSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-5 text-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leadingIcon,
  trailingIcon,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(BASE, BUTTON_VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
      {loading ? null : trailingIcon}
    </button>
  )
}
