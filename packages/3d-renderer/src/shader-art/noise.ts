// Procedural noise — the raw material of every pattern. Wraps three TSL's MaterialX
// noise in our composition contract (node in/out, named args, no side effects). Knows
// nothing of materials/uniforms/React — it only builds and returns nodes.
import { mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec2, abs, float } from 'three/tsl'
import { asFloatNode, asVec3Node } from '../tsl'

export interface FbmOptions {
  /** fbm octave count — more octaves stack finer detail (one noise call per octave, so costly). */
  octaves?: number
  /** per-octave frequency multiplier (usually 2) — larger spreads the grain between octaves. */
  lacunarity?: number
  /** per-octave amplitude falloff (usually 0.5) — larger keeps high frequencies, rougher grain. */
  gain?: number
}

/** fbm (fractal Brownian motion) — base grain of clouds/smoke/nebulae. Returns ≈ [-1,1]. */
export function fbm(p: unknown, { octaves = 3, lacunarity = 2, gain = 0.5 }: FbmOptions = {}) {
  return mx_fractal_noise_float(asVec3Node(p), octaves, lacunarity, gain)
}

/** fbm remapped to [0,1] — for use as density/mask. */
export function fbm01(p: unknown, opts?: FbmOptions) {
  return fbm(p, opts).mul(0.5).add(0.5)
}

/** Single-octave gradient noise ([-1,1]) — fine grain/dither (cheaper than fbm). */
export function gnoise(p: unknown) {
  return mx_noise_float(asVec3Node(p))
}

/** Ridged noise ([0,1]) — inverts |fbm| to make sharp ridges / flame filaments. */
export function ridged(p: unknown, opts?: FbmOptions) {
  return float(1).sub(abs(fbm(p, opts)))
}

/** Worley (cellular) noise → distance to the two nearest cell centers. f2-f1 is the cell
 *  boundary, f1 the distance to the nearest center. Material for cell/crystal/droplet
 *  patterns. Higher jitter makes cell centers more irregular. */
export function worley(p: unknown, jitter = 1) {
  const d = mx_worley_noise_vec2(asVec3Node(p), float(jitter))
  return { f1: asFloatNode(d.x), f2: asFloatNode(d.y) }
}
