import * as THREE from 'three/webgpu'

// A 1D palette ramp baked from the universe's emotions, sampled by the sky shaders. Each
// emotion owns a band of the ramp proportional to its weight, blended smoothly across band
// centers — so a 1-emotion universe reads as a single hue and an N-emotion universe divides
// into N legible color zones. The count-driven structure lives HERE (CPU), where it's exact,
// so the TSL effects stay faithful to their react-bits originals and just sample this ramp.
//
// This mirrors how several react-bits shaders take a `sampler2D` gradient uniform.

export interface GradientStop {
  /** Emotion color — `#rrggbb`, `#rgb`, or 0xRRGGBB. */
  readonly color: string | number
  /** Raw (unnormalized) share; normalized across all stops. */
  readonly weight: number
}

const GRADIENT_WIDTH = 256

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

/** Fill the ramp bytes from the emotion stops (weight-sized bands, smooth blend). */
export function updateEmotionGradientTexture(
  texture: THREE.DataTexture,
  stops: readonly GradientStop[],
): void {
  const data = texture.image.data as Uint8ClampedArray | Uint8Array
  const rgb = stops.map((s) => toRgb(s.color))
  const total = stops.reduce((sum, s) => sum + Math.max(s.weight, 0), 0)

  // Band centers along [0,1] (running weight midpoint), like a cumulative color-stop layout.
  const centers: number[] = []
  let acc = 0
  for (const s of stops) {
    const w = total > 0 ? Math.max(s.weight, 0) / total : 1 / Math.max(stops.length, 1)
    centers.push(acc + w / 2)
    acc += w
  }

  for (let x = 0; x < GRADIENT_WIDTH; x++) {
    const t = (x + 0.5) / GRADIENT_WIDTH
    let r = 10
    let g = 10
    let b = 18
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
