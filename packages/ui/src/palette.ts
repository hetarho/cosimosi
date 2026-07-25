/**
 * The colour system — a TWO-LAYER token architecture (the single source of colour truth) and the
 * theme registry.
 *
 * LAYER 1 — the primitive palette (`p`): clean OKLCH *ramps*, one per hue family
 * (navy · lavender · chartreuse · … like `red-50 … red-950`). Each ramp shares one perceptual
 * lightness scale and a chroma curve that peaks where that hue is most vivid, so every ramp is
 * smooth and internally consistent. These are the ONLY raw colour literals in the system.
 *
 * LAYER 2 — the semantic tokens (`themes`): each theme (a *universe*) maps its colour roles to a
 * palette STEP — it never holds a raw colour. Because roles reference shared ramp steps, two roles
 * can't drift into subtly-different colours: e.g. `primary` and `focus-ring` are both lavender
 * steps. The roles cover the whole surface of the 2D language, including the physical-light
 * constants (`specular`/`depth`) the glass material is built from — so nothing downstream of this
 * file names a colour.
 *
 * ADDING A THEME IS A DATA CHANGE IN THIS FILE, NOTHING ELSE. Add a `ThemeDefinition` to `THEMES`
 * and `pnpm gen:tokens` emits its `[data-theme='<key>']` block; `ThemeKey`, the showcase's theme
 * list, the WCAG contrast suite, and the RN bridge all derive from the registry. Switching the
 * active theme is one edit: `defaultThemeKey`. `palette.test.ts` fails the build if any of that
 * stops being true. The 3D universe skins (`@cosimosi/3d-renderer`) are a SEPARATE axis with their
 * own registry — a theme here does not require one there.
 */

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
  /**
   * The lit edge of the glass material — the specular highlight on a rim, a gloss gradient, a
   * thumb. Physical light rather than brand colour, but a theme still owns it: a warm universe
   * wants a warm highlight, and a light-ground theme would have to invert it.
   */
  specular: string
  /** The shadow colour every elevation is mixed from — the theme's ground, pushed to near-black. */
  depth: string
}

/** A registered theme: its identity, the copy the showcase reads, and its role map. */
export interface ThemeDefinition {
  /** Display name (the design showcase's theme list reads this — never a hardcoded label). */
  readonly label: string
  /** One line on what the universe feels like. */
  readonly blurb: string
  readonly palette: ThemePalette
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

// The ramps. The neutral carries a whisper of hue (cool navy); accents peak where each hue is most
// saturated. { hue°, peakLightness, maxChroma }.
const p = {
  navy: ramp(269, 0.35, 0.05), // cool neutral (aurora ground + text) — chroma peaks dark so grounds keep their navy identity
  lavender: ramp(298, 0.63, 0.2), // aurora primary — neon violet (chroma pushed to match chartreuse's vividity)
  chartreuse: ramp(122, 0.86, 0.18), // aurora secondary
  mint: ramp(168, 0.78, 0.175), // aurora tertiary — neon teal (chroma pushed to match chartreuse's vividity)
  gold: ramp(85, 0.86, 0.15), // warning
  red: ramp(22, 0.58, 0.18), // danger
  green: ramp(156, 0.74, 0.14), // success
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
  // Starlight is white on a cool ground; depth is the navy ground pushed below the darkest step, so
  // shadows read as the universe's own darkness rather than a grey film over it.
  specular: 'oklch(1 0 0)',
  depth: 'oklch(0.06 0.018 269)',
}

/**
 * The theme registry — the only list of themes in the codebase. Every consumer derives from it.
 */
const THEMES = {
  aurora: {
    label: 'Aurora',
    blurb: 'Cool borealis — navy ground · lavender · chartreuse · mint.',
    palette: aurora,
  },
} satisfies Record<string, ThemeDefinition>

export const themes: Record<ThemeKey, ThemeDefinition> = THEMES

/** Derived from the registry — adding a theme widens this type with no edit here. */
export type ThemeKey = keyof typeof THEMES

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]

export function isThemeKey(value: string): value is ThemeKey {
  return value in THEMES
}

/** The active universe. Switching the whole app's 2D skin is this one edit. */
export const defaultThemeKey: ThemeKey = 'aurora'

/** The active theme's resolved role map — the static `@theme`, the RN bridge, and TS reads use this. */
export const palette: ThemePalette = THEMES[defaultThemeKey].palette
