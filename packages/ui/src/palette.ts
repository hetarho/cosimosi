/**
 * The palette — every color literal in the design system, in OKLCH, grouped by theme.
 *
 * A theme is one **universe**: its key is the universe skin's key (aurora · ember), and
 * it fills the full set of color roles below. Tokens (tokens.ts) reference a theme's
 * palette by role and never hold a raw color. Web swaps themes at runtime by setting
 * `data-theme` on a subtree (gen-tokens emits a `--color-*` block per theme); the 3D
 * universe swaps the matching skin. Add a universe = add a theme here + a skin of the
 * same key. OKLCH keeps tones perceptually consistent; the React-Native bridge and the
 * WCAG contrast check derive sRGB from these via lib/oklch (RN can't parse oklch()).
 */

export type ThemeKey = 'aurora' | 'ember'

/** The color roles a theme fills. Mirrors tokens.ts `color` and tokens.test.ts pairs. */
export interface ThemePalette {
  bg: string
  surface: string
  'surface-raised': string
  text: string
  'text-muted': string
  'text-subtle': string
  border: string
  primary: string
  'primary-foreground': string
  secondary: string
  'secondary-foreground': string
  tertiary: string
  'tertiary-foreground': string
  danger: string
  'danger-foreground': string
  success: string
  'success-foreground': string
  warning: string
  'warning-foreground': string
  'focus-ring': string
  overlay: string
}

/** Aurora — cool borealis: lavender · chartreuse · mint on deep cosmic navy (the Acid Bloom set). */
const aurora: ThemePalette = {
  bg: 'oklch(0.177 0.034 269.6)',
  surface: 'oklch(0.222 0.041 268.3)',
  'surface-raised': 'oklch(0.29 0.062 269.5)',
  text: 'oklch(0.97 0.009 264.5)',
  'text-muted': 'oklch(0.826 0.035 267.6)',
  'text-subtle': 'oklch(0.721 0.045 270.7)',
  border: 'oklch(0.344 0.063 269.6)',
  primary: 'oklch(0.762 0.088 297.8)',
  'primary-foreground': 'oklch(0.244 0.082 295)',
  secondary: 'oklch(0.874 0.134 120.7)',
  'secondary-foreground': 'oklch(0.27 0.057 125)',
  tertiary: 'oklch(0.878 0.079 164.8)',
  'tertiary-foreground': 'oklch(0.248 0.045 165.6)',
  danger: 'oklch(0.794 0.121 11.3)',
  'danger-foreground': 'oklch(0.236 0.075 15.7)',
  success: 'oklch(0.835 0.11 167.8)',
  'success-foreground': 'oklch(0.227 0.039 172)',
  warning: 'oklch(0.888 0.12 84.7)',
  'warning-foreground': 'oklch(0.296 0.061 86.2)',
  'focus-ring': 'oklch(0.824 0.071 298.6)',
  overlay: 'oklch(0.13 0.022 264.6 / 0.66)',
}

/** Ember — warm cosmic: ember-coral · rose · gold on a smouldering dark ground (analogous warm hues). */
const ember: ThemePalette = {
  bg: 'oklch(0.138 0.012 6.2)',
  surface: 'oklch(0.194 0.019 1.1)',
  'surface-raised': 'oklch(0.243 0.03 1.4)',
  text: 'oklch(0.97 0.01 41.9)',
  'text-muted': 'oklch(0.851 0.028 34.3)',
  'text-subtle': 'oklch(0.741 0.038 32.8)',
  border: 'oklch(0.339 0.04 9.7)',
  primary: 'oklch(0.733 0.138 44.5)',
  'primary-foreground': 'oklch(0.217 0.047 45.8)',
  secondary: 'oklch(0.719 0.153 1.8)',
  'secondary-foreground': 'oklch(0.225 0.071 357.5)',
  tertiary: 'oklch(0.853 0.109 82.2)',
  'tertiary-foreground': 'oklch(0.277 0.046 83.7)',
  danger: 'oklch(0.741 0.158 19.3)',
  'danger-foreground': 'oklch(0.235 0.075 21.8)',
  success: 'oklch(0.809 0.116 151.1)',
  'success-foreground': 'oklch(0.231 0.054 150.2)',
  warning: 'oklch(0.877 0.127 83.3)',
  'warning-foreground': 'oklch(0.293 0.06 84.3)',
  'focus-ring': 'oklch(0.797 0.106 48.2)',
  overlay: 'oklch(0.119 0.015 5.9 / 0.66)',
}

export const themes: Record<ThemeKey, ThemePalette> = { aurora, ember }

export const defaultThemeKey: ThemeKey = 'aurora'

/** The active theme's palette — the static `@theme`, the RN bridge, and TS reads use this. */
export const palette: ThemePalette = themes[defaultThemeKey]
