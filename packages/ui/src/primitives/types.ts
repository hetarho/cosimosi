import type { ReactNode } from 'react'

/**
 * Design-system-specific prop fragments, shared by each primitive's web (*.tsx)
 * and native (*.native.tsx) implementation so the two stay API-compatible. Each
 * platform file intersects these with its element's own attributes (DOM
 * `ButtonHTMLAttributes` vs RN `PressableProps`). Platform class strings are NOT
 * shared here — web needs hover/focus-visible/ring/transition utilities that have
 * no React Native equivalent.
 *
 * Primitives take copy through props (ReactNode / string), never as embedded
 * literals, so consumers pass localized message output.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ControlSize = 'sm' | 'md' | 'lg'
export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'
export type CardVariant = 'solid' | 'glass'

export interface ButtonOwnProps {
  variant?: ButtonVariant
  size?: ControlSize
  /** Show a spinner and block interaction. */
  loading?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  children?: ReactNode
}

export interface IconButtonOwnProps {
  variant?: ButtonVariant
  size?: ControlSize
  loading?: boolean
  /** Accessible name for the icon-only control. Required so it is never unlabeled. */
  label: string
  icon: ReactNode
}

export interface FieldOwnProps {
  label?: ReactNode
  description?: ReactNode
  /** Error message; when present the field is marked invalid. */
  error?: ReactNode
  size?: ControlSize
}

export interface ToggleOwnProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: ReactNode
  /** Accessible name when no visible `label` is given (so the control is never unnamed). */
  ariaLabel?: string
  disabled?: boolean
}

export interface DialogOwnProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  /** Accessible name for the surface when no visible `title` is rendered. */
  ariaLabel?: string
  /** Accessible name for the close affordance (consumer passes localized copy). */
  closeLabel: string
  children?: ReactNode
}

export interface TooltipOwnProps {
  content: ReactNode
  children: ReactNode
}

export interface ToastOwnProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant?: ToastVariant
  /** Auto-dismiss after this many ms; omit to require manual dismissal. */
  durationMs?: number
  children?: ReactNode
}

export interface BadgeOwnProps {
  variant?: BadgeVariant
  children?: ReactNode
}

export interface CardOwnProps {
  /** `solid` = elevated opaque content panel; `glass` = glass material for cards over rich backdrops. */
  variant?: CardVariant
  children?: ReactNode
}

export interface SkeletonOwnProps {
  width?: number | string
  height?: number | string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

export interface VisuallyHiddenProps {
  children: ReactNode
}
