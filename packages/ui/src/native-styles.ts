import { oklchToRnColor } from './lib/oklch.ts'
import { tokens, type ColorToken } from './tokens.ts'

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

/**
 * Token colors as React-Native-safe strings. The tokens author color in OKLCH,
 * which RN `StyleSheet` cannot parse — so each is converted to `#rrggbb` / `rgba()`
 * here (once, at module load). Same single source as web; only the encoding differs.
 */
export const color = Object.fromEntries(
  Object.entries(tokens.color).map(([role, value]) => [role, oklchToRnColor(value)]),
) as Record<ColorToken, string>

/**
 * The whole token map, with RN-safe colours — what `@cosimosi/ui`'s **native entry** exports as
 * `tokens`, so `tokens.color.bg` is a value React Native can actually paint.
 *
 * `tokens.ts` authors colour in OKLCH for the web pipeline, and RN `StyleSheet` silently DROPS a
 * colour it cannot parse: a screen styled straight from the shared map came out with no ground and no
 * ink at all, while the primitives (which read `color` above) looked right — the failure is invisible
 * until someone looks at a device. Exporting the converted map under the same name keeps one token
 * source and one import for app code; only the encoding differs per platform, exactly as it does for
 * the primitives. `native-tokens.test.ts` holds the line.
 */
export const nativeTokens = { ...tokens, color } as const

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
