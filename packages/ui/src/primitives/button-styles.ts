import type { ButtonColor, ButtonVariant } from './types.ts'

/** Shared focus-ring utilities for web controls (Button, IconButton, fields, switch). */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

/**
 * Web buttons are TWO composable axes — appearance × colour — shared by Button and IconButton.
 * `BUTTON_APPEARANCE` picks the skin (filled lens / border+glow ring / bare text); `BUTTON_COLOR`
 * carries the role colour as CSS vars the skin reads. Both live in `base.css` (`.btn-*`) so they
 * reskin with the theme and carry no hardcoded colour. Any appearance combines with any colour.
 */
export const BUTTON_APPEARANCE: Record<ButtonVariant, string> = {
  contained: 'btn-contained',
  outlined: 'btn-outlined',
  text: 'btn-text',
}

export const BUTTON_COLOR: Record<ButtonColor, string> = {
  primary: 'btn-c-primary',
  secondary: 'btn-c-secondary',
  tertiary: 'btn-c-tertiary',
  neutral: 'btn-c-neutral',
  danger: 'btn-c-danger',
}
