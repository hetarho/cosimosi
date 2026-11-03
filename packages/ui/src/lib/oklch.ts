/**
 * OKLCH token strings → sRGB. Pure and DOM-free; the conversion itself is `@cosimosi/color`.
 *
 * The palette authors color in OKLCH (tokens.ts / palette.ts). Web consumes that
 * verbatim through Tailwind's `@theme` — modern browsers render oklch() natively.
 * Two consumers can't: **React Native** `StyleSheet` (hex/rgb/hsl only, no oklch)
 * and the WCAG **contrast** check. Both derive sRGB from the one OKLCH source here,
 * so there is still a single color source — never a parallel hex table.
 */

import { encodeLinear, okLabToLinearRgb, okLchToOkLab } from '@cosimosi/color'

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
  const [r, g, b] = okLabToLinearRgb(okLchToOkLab({ l: L, c: C, h: H }))
  return { r, g, b }
}

const to255 = (c: number): number => Math.round(encodeLinear(c) * 255)
const hex2 = (n: number): string => n.toString(16).padStart(2, '0')

/**
 * OKLCH → a React-Native-safe color string: `#rrggbb`, or `rgba(r, g, b, a)` when the
 * OKLCH carries alpha. A non-OKLCH input is returned unchanged (already RN-valid).
 *
 * `alpha` multiplies the color's own alpha, so native can reproduce the web recipes that mix a role
 * colour into transparency (`color-mix(in oklab, var(--color-x) 50%, transparent)`) instead of
 * approximating them with a full-strength colour — the two platforms then read the same weight.
 */
export function oklchToRnColor(input: string, alpha = 1): string {
  const parsed = parseOklch(input)
  if (!parsed) return input
  parsed.alpha *= alpha
  const { r, g, b } = oklchToLinearRgb(parsed)
  const R = to255(r)
  const G = to255(g)
  const B = to255(b)
  if (parsed.alpha < 1) return `rgba(${R}, ${G}, ${B}, ${parsed.alpha})`
  return `#${hex2(R)}${hex2(G)}${hex2(B)}`
}
