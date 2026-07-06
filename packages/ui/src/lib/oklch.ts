/**
 * OKLCH → sRGB conversion (Björn Ottosson's OKLab). Pure and DOM-free.
 *
 * The palette authors color in OKLCH (tokens.ts / palette.ts). Web consumes that
 * verbatim through Tailwind's `@theme` — modern browsers render oklch() natively.
 * Two consumers can't: **React Native** `StyleSheet` (hex/rgb/hsl only, no oklch)
 * and the WCAG **contrast** check. Both derive sRGB from the one OKLCH source here,
 * so there is still a single color source — never a parallel hex table.
 */

export interface Oklch {
  L: number
  C: number
  H: number
  alpha: number
}

const OKLCH_RE = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/i

export function parseOklch(input: string): Oklch | null {
  const m = OKLCH_RE.exec(input.trim())
  if (!m) return null
  const L = m[2] === '%' ? parseFloat(m[1]) / 100 : parseFloat(m[1])
  const alpha = m[5] === undefined ? 1 : m[6] === '%' ? parseFloat(m[5]) / 100 : parseFloat(m[5])
  return { L, C: parseFloat(m[3]), H: parseFloat(m[4]), alpha }
}

/** OKLCH → linear-light sRGB (unclamped; may fall slightly outside [0,1] near the gamut edge). */
export function oklchToLinearRgb({ L, C, H }: Oklch): { r: number; g: number; b: number } {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const bb = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147011 * s,
  }
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
const linearToSrgb = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const to255 = (c: number): number => Math.round(clamp01(linearToSrgb(clamp01(c))) * 255)
const hex2 = (n: number): string => n.toString(16).padStart(2, '0')

/**
 * OKLCH → a React-Native-safe color string: `#rrggbb`, or `rgba(r, g, b, a)` when the
 * OKLCH carries alpha. A non-OKLCH input is returned unchanged (already RN-valid).
 */
export function oklchToRnColor(input: string): string {
  const parsed = parseOklch(input)
  if (!parsed) return input
  const { r, g, b } = oklchToLinearRgb(parsed)
  const R = to255(r)
  const G = to255(g)
  const B = to255(b)
  if (parsed.alpha < 1) return `rgba(${R}, ${G}, ${B}, ${parsed.alpha})`
  return `#${hex2(R)}${hex2(G)}${hex2(B)}`
}
