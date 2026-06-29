/**
 * WCAG 2.x contrast math over sRGB hex colors. Pure and DOM-free so the token
 * contrast guarantees are checked in a plain unit test.
 */

/** AA contrast ratio for normal-size text. */
export const WCAG_AA_TEXT = 4.5

/** AA contrast ratio for large text and UI components. */
export const WCAG_AA_LARGE = 3

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

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

/** Relative luminance (0–1) of an sRGB hex color. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b)
}

/** Contrast ratio (1–21) between two sRGB hex colors. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}
