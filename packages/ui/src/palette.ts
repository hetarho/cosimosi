/**
 * The colour system — a TWO-LAYER token architecture (the single source of colour truth).
 *
 * LAYER 1 — the primitive palette (`p`): clean OKLCH *ramps*, one per hue family
 * (navy · lavender · chartreuse · … like `red-50 … red-950`). Each ramp shares one perceptual
 * lightness scale and a chroma curve that peaks where that hue is most vivid, so every ramp is
 * smooth and internally consistent. These are the ONLY raw colour literals in the system.
 *
 * LAYER 2 — the semantic tokens (`themes`): each theme (a *universe*: aurora · ember) maps its
 * colour roles to a palette STEP — it never holds a raw colour. Because roles reference shared
 * ramp steps, two roles can't drift into subtly-different colours: e.g. `primary` and `focus-ring`
 * are both lavender steps, and `danger`/`success`/`warning` resolve to the SAME step across themes.
 *
 * Consumption is unchanged: `gen-tokens.mjs` emits a `--color-*` block per theme (semantic only —
 * the palette stays authoring-side), web swaps themes via `data-theme`, the RN bridge + WCAG check
 * derive sRGB via lib/oklch. Add a universe = add a theme here + a 3D skin of the same key.
 */

export type ThemeKey = 'aurora' | 'ember'

/** The colour roles a theme fills. Mirrors tokens.ts `color` and tokens.test.ts pairs. */
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

// ── Layer 1: primitive palette ─────────────────────────────────────────────────
type Step = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950
const STEPS: readonly Step[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

// One perceptual lightness per step, shared by every ramp (dark-first: 950 ≈ deep ground, 50 ≈ near
// white). Anchored so navy 950/900/800 land on the app's bg / surface / raised surfaces.
const L: Record<Step, number> = {
  50: 0.975,
  100: 0.94,
  200: 0.885,
  300: 0.8,
  400: 0.72,
  500: 0.63,
  600: 0.53,
  700: 0.435,
  800: 0.31,
  900: 0.235,
  950: 0.165,
}

// Chroma follows a Gaussian in lightness, peaking at `peakL` — so warm/yellow hues (vivid when
// light) and cool/blue hues (vivid mid-tone) each stay smooth and in-gamut without per-step tuning.
const CHROMA_WIDTH = 0.26
function ramp(hue: number, peakL: number, maxChroma: number): Record<Step, string> {
  const out = {} as Record<Step, string>
  for (const step of STEPS) {
    const l = L[step]
    const c = maxChroma * Math.exp(-(((l - peakL) / CHROMA_WIDTH) ** 2))
    out[step] = `oklch(${l} ${c.toFixed(3)} ${hue})`
  }
  return out
}

/** Add an alpha channel to an `oklch(L C H)` literal (for the translucent overlay role). */
const withAlpha = (oklch: string, alpha: number): string => oklch.replace(/\)$/, ` / ${alpha})`)

// The ramps. Neutrals carry a whisper of hue (cool navy / warm umber); accents peak where each hue
// is most saturated. { hue°, peakLightness, maxChroma }.
const p = {
  navy: ramp(269, 0.35, 0.05), // cool neutral (aurora ground + text) — chroma peaks dark so grounds keep their navy identity
  umber: ramp(35, 0.4, 0.042), // warm neutral (ember ground + text) — chroma peaks dark for a smouldering ground
  lavender: ramp(298, 0.6, 0.15), // aurora primary
  chartreuse: ramp(122, 0.86, 0.18), // aurora secondary
  mint: ramp(168, 0.78, 0.135), // aurora tertiary
  coral: ramp(47, 0.72, 0.16), // ember primary
  rose: ramp(8, 0.62, 0.16), // ember secondary
  gold: ramp(85, 0.86, 0.15), // warning (both) + ember tertiary
  red: ramp(22, 0.58, 0.18), // danger (both)
  green: ramp(156, 0.74, 0.14), // success (both)
} as const

// ── Layer 2: semantic tokens (role → palette step) ─────────────────────────────

/** Aurora — cool borealis: navy ground · lavender · chartreuse · mint. */
const aurora: ThemePalette = {
  bg: p.navy[950],
  surface: p.navy[900],
  'surface-raised': p.navy[800],
  text: p.navy[50],
  'text-muted': p.navy[200],
  'text-subtle': p.navy[300],
  border: p.navy[700],
  primary: p.lavender[400],
  'primary-foreground': p.lavender[950],
  secondary: p.chartreuse[200],
  'secondary-foreground': p.chartreuse[950],
  tertiary: p.mint[300],
  'tertiary-foreground': p.mint[950],
  danger: p.red[400],
  'danger-foreground': p.red[950],
  success: p.green[300],
  'success-foreground': p.green[950],
  warning: p.gold[200],
  'warning-foreground': p.gold[950],
  'focus-ring': p.lavender[300],
  overlay: withAlpha(p.navy[950], 0.66),
}

/** Ember — warm cosmic: umber ground · coral · rose · gold. */
const ember: ThemePalette = {
  bg: p.umber[950],
  surface: p.umber[900],
  'surface-raised': p.umber[800],
  text: p.umber[50],
  'text-muted': p.umber[200],
  'text-subtle': p.umber[300],
  border: p.umber[700],
  primary: p.coral[400],
  'primary-foreground': p.coral[950],
  secondary: p.rose[400],
  'secondary-foreground': p.rose[950],
  tertiary: p.gold[300],
  'tertiary-foreground': p.gold[950],
  danger: p.red[400],
  'danger-foreground': p.red[950],
  success: p.green[300],
  'success-foreground': p.green[950],
  warning: p.gold[200],
  'warning-foreground': p.gold[950],
  'focus-ring': p.coral[300],
  overlay: withAlpha(p.umber[950], 0.66),
}

export const themes: Record<ThemeKey, ThemePalette> = { aurora, ember }

export const defaultThemeKey: ThemeKey = 'aurora'

/** The active theme's resolved role map — the static `@theme`, the RN bridge, and TS reads use this. */
export const palette: ThemePalette = themes[defaultThemeKey]
