import { colorToLinearRgb, okLabToLinearRgb, okLchToOkLab, type OkLch } from './oklab.ts'
import type { Color } from './palette.ts'

// Must stay equal to the slack `SnapToEmotionStep` allows in
// apps/api/internal/account/mood_color.go — one 8-bit rounding step either side of the cube — or the
// picker offers chroma the server rejects.
const ENCODING_TOLERANCE = 2 / 255

// No sRGB color exceeds ~0.37 OkLCH chroma, so this bounds the search rather than the result.
const CHROMA_CEILING = 0.4
// Finer than 8-bit precision can express.
const CHROMA_EPSILON = 0.0005

export function isInGamut(lch: OkLch): boolean {
  return okLabToLinearRgb(okLchToOkLab(lch)).every(
    (channel) => channel >= -ENCODING_TOLERANCE && channel <= 1 + ENCODING_TOLERANCE,
  )
}

/**
 * The most chroma this lightness and hue can hold in sRGB.
 *
 * The gamut is a lopsided solid in OkLCH — the boundary moves with every degree of hue — and chroma
 * past it does not fail visibly, it clips onto a *different* hue. Callers offer chroma as a fraction
 * of this so every position is reachable at every hue.
 *
 * Bisection works because the predicate is monotonic in chroma at fixed lightness and hue.
 */
export function maxChromaInGamut(lightness: number, hue: number): number {
  if (!isInGamut({ l: lightness, c: 0, h: hue })) return 0
  let low = 0
  let high = CHROMA_CEILING
  while (high - low > CHROMA_EPSILON) {
    const mid = (low + high) / 2
    if (isInGamut({ l: lightness, c: mid, h: hue })) low = mid
    else high = mid
  }
  return low
}

/** The same OkLCH with its chroma pulled back to the boundary, keeping the lightness and the hue. */
export function clampChromaToGamut(lch: OkLch): OkLch {
  return { ...lch, c: Math.min(lch.c, maxChromaInGamut(lch.l, lch.h)) }
}

/**
 * sRGB relative luminance (WCAG's Y) — the light the color puts on screen, which is not OkLCH
 * lightness: that is perceptual and hue-independent, so a yellow and a blue on the same step differ
 * by half again in emitted light. `mood-color-risk.ts` reads its bands from here for that reason.
 */
export function relativeLuminance(color: Color): number {
  const [r, g, b] = colorToLinearRgb(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
