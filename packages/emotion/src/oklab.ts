import {
  hexToLinearRgb,
  linearRgbToHex,
  linearRgbToOkLab,
  okLabToLinearRgb,
  okLabToOkLch,
  okLchToOkLab,
  type OkLab,
  type OkLch,
} from '@cosimosi/color'
import { VALUES } from '@cosimosi/config'

import type { Color } from './palette.ts'

export type { OkLab, OkLch }

export const NEAR_NEUTRAL_HUE_BUCKET = Math.ceil(360 / VALUES.palette.hueBucketDegrees)

export function colorToOkLab(color: Color): OkLab {
  return linearRgbToOkLab(hexToLinearRgb(color))
}

/** Clamps out-of-gamut light away, so a reachability check reads `okLabToLinearRgb` instead. */
export function okLabToColor(lab: OkLab): Color {
  return linearRgbToHex(okLabToLinearRgb(lab))
}

export function colorToOkLch(color: Color): OkLch {
  return okLabToOkLch(colorToOkLab(color))
}

export function okLchToColor(lch: OkLch): Color {
  return okLabToColor(okLchToOkLab(lch))
}

export function hueBucket(color: Color): number {
  const lch = colorToOkLch(color)
  if (lch.c <= VALUES.palette.nearNeutralChromaMax) return NEAR_NEUTRAL_HUE_BUCKET
  return Math.floor(lch.h / VALUES.palette.hueBucketDegrees)
}

export function deltaEOkLab(first: Color, second: Color): number {
  const a = colorToOkLab(first)
  const b = colorToOkLab(second)
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b)
}
