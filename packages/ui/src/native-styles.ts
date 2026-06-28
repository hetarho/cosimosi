import { tokens } from './tokens.ts'

/**
 * React Native styling values derived from the canonical token map (tokens.ts).
 *
 * Native primitives style with `StyleSheet`/`style={}` rather than Tailwind classes
 * — the web app owns the Tailwind v4 pipeline, while RN reads the same tokens here.
 * This keeps the single token source: change a value in tokens.ts and both web
 * (via theme.gen.css) and native (via this module) follow.
 */

function remToPx(value: string): number {
  if (value.endsWith('rem')) return parseFloat(value) * 16
  if (value.endsWith('px')) return parseFloat(value)
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Raw token colors (hex / rgba strings — both valid in RN). */
export const color = tokens.color

/** Corner radii in px (RN has no rem). */
export const radius = {
  sm: remToPx(tokens.radius.sm),
  md: remToPx(tokens.radius.md),
  lg: remToPx(tokens.radius.lg),
  xl: remToPx(tokens.radius.xl),
  full: 9999,
} as const

/** Spacing scale in px. */
export const space = tokens.spacing

/** Font sizes in px. */
export const fontSize = tokens.fontSize
