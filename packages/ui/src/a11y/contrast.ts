/**
 * WCAG 2.x contrast math. Pure and DOM-free so the token contrast guarantees are
 * checked in a plain unit test. Accepts both sRGB hex and OKLCH (the token format);
 * OKLCH is converted to linear sRGB via lib/oklch.
 */

import { linearLuminance, srgbToLinear } from '@cosimosi/color'

import { oklchToLinearRgb, parseOklch } from '../lib/oklch.ts'

/** AA contrast ratio for normal-size text. */
export const WCAG_AA_TEXT = 4.5

/** AA contrast ratio for large text and UI components. */
export const WCAG_AA_LARGE = 3

/** Parse `#rgb` / `#rrggbb` into 8-bit channels. Throws on anything else (non-hex tokens aren't contrast-checked). */
export function parseHex(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) throw new Error(`not a hex color: ${hex}`)
  const value = match[1]
  const full = value.length === 3 ? value.replace(/(.)/g, '$1$1') : value
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Relative luminance (0–1) of an sRGB hex or OKLCH color. */
export function relativeLuminance(color: string): number {
  if (color.trimStart().toLowerCase().startsWith('oklch')) {
    const parsed = parseOklch(color)
    if (!parsed) throw new Error(`not an oklch color: ${color}`)
    const { r, g, b } = oklchToLinearRgb(parsed)
    return linearLuminance([clamp01(r), clamp01(g), clamp01(b)])
  }
  const { r, g, b } = parseHex(color)
  return linearLuminance([srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)])
}

/** Contrast ratio (1–21) between two sRGB hex colors. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}
