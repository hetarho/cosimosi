import type { LinearRgb } from './srgb.ts'

export interface OkLab {
  readonly l: number
  readonly a: number
  readonly b: number
}

export interface OkLch {
  readonly l: number
  readonly c: number
  /** Hue in degrees, normalized to [0, 360). */
  readonly h: number
}

// Björn Ottosson's OKLab matrices: linear sRGB → LMS, cube root, LMS → Lab, and their inverses.

export function linearRgbToOkLab([r, g, b]: LinearRgb): OkLab {
  const lRoot = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const mRoot = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const sRoot = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  }
}

/**
 * The unclamped linear-light channels an OkLab value asks for. A channel outside `[0, 1]` means the
 * color is not expressible in sRGB, so a reachability check reads this rather than an encoded hex.
 */
export function okLabToLinearRgb(lab: OkLab): [number, number, number] {
  const lRoot = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b
  const mRoot = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b
  const sRoot = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b
  const l = lRoot ** 3
  const m = mRoot ** 3
  const s = sRoot ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function okLabToOkLch(lab: OkLab): OkLch {
  const h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI
  return {
    l: lab.l,
    c: Math.hypot(lab.a, lab.b),
    h: h < 0 ? h + 360 : h,
  }
}

export function okLchToOkLab(lch: OkLch): OkLab {
  const radians = (lch.h * Math.PI) / 180
  return {
    l: lch.l,
    a: lch.c * Math.cos(radians),
    b: lch.c * Math.sin(radians),
  }
}
