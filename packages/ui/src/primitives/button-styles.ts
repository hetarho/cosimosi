import type { ButtonVariant } from './types.ts'

/** Shared focus-ring utilities for web controls (Button, IconButton, fields, switch). */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

/**
 * Web button color variants — shared by Button and IconButton so the palette stays single-source.
 * Each variant is a glassmorphic pane (translucent tint + lit edge + soft coloured glow); the recipe
 * lives in `base.css` (`.glass-btn*`) so it reskins with the theme and carries no hardcoded colour.
 */
export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'glass-btn glass-btn-primary',
  secondary: 'glass-btn glass-btn-secondary',
  ghost: 'glass-btn glass-btn-ghost',
  danger: 'glass-btn glass-btn-danger',
}
