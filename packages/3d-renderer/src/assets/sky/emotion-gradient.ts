import * as THREE from 'three/webgpu'

// A 1D palette ramp baked from the universe's emotions, sampled by the sky shaders. An emotion's
// weight is its PRIORITY in the universe, and it shapes its band twice over: the band's WIDTH is
// proportional to the weight (the primary feeling claims the most sky), and the band's DEPTH fades
// with rank — the primary emotion paints at full color while lesser feelings sink toward the bare
// night base, so a faint emotion reads as a pale wash, not an equal stripe. A 1-emotion universe
// reads as a single full-strength hue. The count/priority-driven structure lives HERE (CPU), where
// it's exact, so the TSL effects stay faithful to their react-bits originals and just sample this ramp.
//
// This mirrors how several react-bits shaders take a `sampler2D` gradient uniform.

export interface GradientStop {
  /** Emotion color — `#rrggbb`, `#rgb`, or 0xRRGGBB. */
  readonly color: string | number
  /** Raw (unnormalized) share; normalized across all stops. */
  readonly weight: number
}

const GRADIENT_WIDTH = 256

/** The bare night the sky is made of where no emotion reaches (`#0a0a12`). */
const NIGHT_BASE: readonly [number, number, number] = [10, 10, 18]

/**
 * How sharply band DEPTH falls behind the primary emotion. Strength is `(share / topShare) ** DEPTH_CURVE`,
 * so `1` fades linearly with weight and larger values sink the lesser emotions toward the night base
 * faster — a low-share feeling reads as a near-transparent wash rather than a merely dimmer stripe.
 * TUNE THIS (with the showcase weight spread) to taste while eyeballing the /test emotion-sky panel.
 */
const DEPTH_CURVE = 1.5

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
  const total = stops.reduce((sum, s) => sum + Math.max(s.weight, 0), 0)
  const shares = stops.map((s) =>
    total > 0 ? Math.max(s.weight, 0) / total : 1 / Math.max(stops.length, 1),
  )
  const topShare = shares.reduce((max, share) => Math.max(max, share), 0)

  // Priority-deep band colors: the primary emotion (largest share) paints at full strength; the
  // rest fade toward the night base in proportion to how far behind the primary they sit.
  const rgb = stops.map((s, i) => {
    const strength = topShare > 0 ? ((shares[i] ?? 0) / topShare) ** DEPTH_CURVE : 1
    const c = toRgb(s.color)
    return [
      NIGHT_BASE[0] + (c[0] - NIGHT_BASE[0]) * strength,
      NIGHT_BASE[1] + (c[1] - NIGHT_BASE[1]) * strength,
      NIGHT_BASE[2] + (c[2] - NIGHT_BASE[2]) * strength,
    ] as [number, number, number]
  })

  // Band centers along [0,1] (running weight midpoint), like a cumulative color-stop layout.
  const centers: number[] = []
  let acc = 0
  for (const share of shares) {
    centers.push(acc + share / 2)
    acc += share
  }

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
