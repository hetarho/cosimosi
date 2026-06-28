import type { ButtonVariant } from './types.ts'

/** Shared focus-ring utilities for web controls (Button, IconButton, fields, switch). */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

/** Web button color variants — shared by Button and IconButton so the palette stays single-source. */
export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'border border-border bg-surface-raised text-text hover:bg-surface',
  ghost: 'bg-transparent text-text hover:bg-surface-raised',
  danger: 'bg-danger text-danger-foreground hover:opacity-90',
}
