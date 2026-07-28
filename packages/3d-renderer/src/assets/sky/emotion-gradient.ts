import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

// A 1D palette ramp baked from the universe's emotions, sampled by the sky recipes. An emotion's
// weight buys it AREA and nothing else: its band's WIDTH is proportional to its share, so the primary
// feeling claims the most sky, while every band carries its colour at the same full depth. A faint
// feeling is a narrow stripe of its true colour, never a washed-out one — a colour diluted toward the
// night loses the hue that identifies it, which is the one thing a palette exists to carry. A shared
// exposure ceiling keeps the enclosing full-frame body below bloom-heavy white; it applies equally to
// every emotion and does not tighten as the count grows.
//
// The band layout lives HERE (CPU), where it is exact, and `emotionRampCenters` publishes it so a
// recipe placing per-emotion features can sample each feeling's own colour rather than guessing.

export interface GradientStop {
  /** Emotion color — `#rrggbb`, `#rgb`, or 0xRRGGBB. */
  readonly color: string | number
  /** Raw (unnormalized) share; normalized across all stops. */
  readonly weight: number
}

const GRADIENT_WIDTH = 256

/** The bare night the sky is made of where no emotion reaches (`#0a0a12`). */
const NIGHT_BASE: readonly [number, number, number] = [10, 10, 18]

/** Normalized shares for a set of stops, primary-first — the band widths, and the only thing an
 *  emotion's weight decides. Shared with `emotionRampCenters` so the ramp and any recipe reading it
 *  agree on the layout by construction. */
function normalizedShares(stops: readonly GradientStop[]): number[] {
  const total = stops.reduce((sum, s) => sum + Math.max(s.weight, 0), 0)
  return stops.map((s) =>
    total > 0 ? Math.max(s.weight, 0) / total : 1 / Math.max(stops.length, 1),
  )
}

/**
 * Where each emotion's band sits along the ramp, in [0, 1] — the running midpoint of its share. A
 * recipe that draws one feature per emotion samples the ramp at `centers[i]` to get that feeling's
 * own colour instead of whatever hue the field value happened to land on.
 */
export function emotionRampCenters(stops: readonly GradientStop[]): number[] {
  const centers: number[] = []
  let acc = 0
  for (const share of normalizedShares(stops)) {
    centers.push(acc + share / 2)
    acc += share
  }
  return centers
}

/** Parse a hex color (string or number) to sRGB bytes [0..255]. */
function toRgb(color: string | number): [number, number, number] {
  if (typeof color === 'number') {
    return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff]
  }
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex
  const int = Number.parseInt(full, 16)
  if (!Number.isFinite(int) || full.length !== 6) return [10, 10, 18]
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff]
}

/** Fill the ramp bytes from the emotion stops (weight-sized bands, priority-deep colors, smooth blend). */
export function updateEmotionGradientTexture(
  texture: THREE.DataTexture,
  stops: readonly GradientStop[],
): void {
  const data = texture.image.data as Uint8ClampedArray | Uint8Array
  // The palette is a full-frame light source and is bloomed with the rest of the scene, so it carries
  // one exposure ceiling. It is the SAME ceiling for every emotion — weight buys area, never depth —
  // and it does not tighten with the count, which would collapse a many-emotion sky toward the night.
  const paletteExposure = VALUES.rendering.emotionSkyExposure

  const rgb = stops.map((s) => {
    const c = toRgb(s.color)
    return [
      NIGHT_BASE[0] + (c[0] - NIGHT_BASE[0]) * paletteExposure,
      NIGHT_BASE[1] + (c[1] - NIGHT_BASE[1]) * paletteExposure,
      NIGHT_BASE[2] + (c[2] - NIGHT_BASE[2]) * paletteExposure,
    ] as [number, number, number]
  })

  const centers = emotionRampCenters(stops)

  for (let x = 0; x < GRADIENT_WIDTH; x++) {
    const t = (x + 0.5) / GRADIENT_WIDTH
    let [r, g, b] = NIGHT_BASE as [number, number, number]
    if (rgb.length === 1) {
      ;[r, g, b] = rgb[0] ?? [r, g, b]
    } else if (rgb.length > 1) {
      if (t <= (centers[0] ?? 0)) {
        ;[r, g, b] = rgb[0] ?? [r, g, b]
      } else if (t >= (centers[centers.length - 1] ?? 1)) {
        ;[r, g, b] = rgb[rgb.length - 1] ?? [r, g, b]
      } else {
        let i = 0
        while (i < centers.length - 1 && t > (centers[i + 1] ?? 1)) i++
        const c0 = rgb[i] ?? [r, g, b]
        const c1 = rgb[i + 1] ?? c0
        const span = Math.max((centers[i + 1] ?? 1) - (centers[i] ?? 0), 1e-4)
        const f = (t - (centers[i] ?? 0)) / span
        const s = f * f * (3 - 2 * f) // smoothstep
        r = c0[0] + (c1[0] - c0[0]) * s
        g = c0[1] + (c1[1] - c0[1]) * s
        b = c0[2] + (c1[2] - c0[2]) * s
      }
    }
    const o = x * 4
    data[o] = Math.round(r)
    data[o + 1] = Math.round(g)
    data[o + 2] = Math.round(b)
    data[o + 3] = 255
  }
  texture.needsUpdate = true
}

/** Build the ramp texture (linear-filtered, clamped) and fill it from the stops. */
export function buildEmotionGradientTexture(stops: readonly GradientStop[]): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    new Uint8Array(GRADIENT_WIDTH * 4),
    GRADIENT_WIDTH,
    1,
    THREE.RGBAFormat,
  )
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  updateEmotionGradientTexture(texture, stops)
  return texture
}
