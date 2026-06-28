/**
 * The canonical design-token source.
 *
 * One source, two consumers:
 * - `pnpm gen:tokens` emits {@link file://./theme.gen.css} — a Tailwind v4 `@theme`
 *   block that both apps load (web via `@tailwindcss/vite`, mobile via NativeWind),
 *   turning these tokens into utility classes and `:root` CSS variables.
 * - TS code imports this map directly for raw values where utilities can't reach:
 *   contrast checks, React Native style props, and tests. This module stays
 *   DOM-free so it runs verbatim on web, React Native, and in Node (ARCHITECTURE §3.5).
 *
 * These are theme-agnostic *foundation* tokens. The theme/background seam
 * (`theme-store`) may override a subset of `color.*` at the app boundary at
 * runtime; it never mutates this map.
 *
 * `CSS_TOKEN_GROUPS` lists the groups the generator emits to CSS. Groups outside
 * it (spacing, font sizes) are TS-only — Tailwind's built-in scales already cover
 * those utilities on both platforms, so re-emitting them would only fight the
 * defaults.
 */

export const tokens = {
  /** Semantic color roles. Dark-first; text pairs are contrast-checked (tokens.test.ts). */
  color: {
    bg: '#0b1020',
    surface: '#131a2e',
    'surface-raised': '#1f294a',
    text: '#f2f5fb',
    'text-muted': '#bcc6de',
    'text-subtle': '#9aa4c2',
    border: '#2c375a',
    primary: '#9db8ff',
    'primary-foreground': '#0a1430',
    danger: '#ff9aa8',
    'danger-foreground': '#3a0a12',
    success: '#7be0bb',
    'success-foreground': '#04221a',
    warning: '#ffd479',
    'warning-foreground': '#3a2a00',
    'focus-ring': '#b9ccff',
    overlay: 'rgba(4, 7, 16, 0.66)',
  },

  /** Corner radii. */
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },

  /** Elevation as web box-shadows; native maps the same intent to its shadow props. */
  shadow: {
    sm: '0 1px 2px rgba(2, 4, 10, 0.5)',
    md: '0 6px 18px rgba(2, 4, 10, 0.55)',
    lg: '0 18px 48px rgba(2, 4, 10, 0.6)',
  },

  /** Transition durations. */
  duration: {
    fast: '120ms',
    base: '200ms',
    slow: '320ms',
  },

  /** Easing curves. */
  ease: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1.2)',
  },

  /** Focus-ring geometry. The ring color is `color.focus-ring`. */
  ring: {
    width: '2px',
    offset: '2px',
  },

  /** Stacking order for layered surfaces. */
  z: {
    base: '0',
    dropdown: '1000',
    overlay: '1100',
    modal: '1200',
    toast: '1300',
    tooltip: '1400',
  },

  /** TS-only: spacing scale for React Native style props. Web uses Tailwind's scale. */
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
  },

  /** TS-only: font sizes (px) for React Native `Text`. Web uses Tailwind's scale. */
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
  },
} as const

/** Token groups the generator writes into `theme.gen.css`. */
export const CSS_TOKEN_GROUPS = ['color', 'radius', 'shadow', 'duration', 'ease', 'ring', 'z'] as const

export type Tokens = typeof tokens
export type ColorToken = keyof Tokens['color']
