// Deterministic Fibonacci-sphere star layout. Pure math (no three/React/DOM) so the
// star renderer and the camera fly-to read the SAME formula and agree on each star's position.
import { clamp01 } from './num'

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

// Self-anchored radial layout (spec 38). A memory's DISTANCE from the central "나" star
// encodes its STRENGTH; its DIRECTION still emerges from the connection graph. Pure math
// (no three/React/DOM) so the layout controller and the renderer agree.
/** Strongest memory shell — sits just outside the self star, near the centre. */
export const R_MIN = 6
/** Weakest (dormant) memory shell — the outer reaches of the universe. Kept inside the
 *  camera's star-shell framing (~46) so the cloud reads tight, not sprawling. */
export const R_MAX = 40
/** Strength = W_ACT·activation + W_INT·intensity: recency leads, emotional intensity tempers. */
export const W_ACT = 0.7
export const W_INT = 0.3

/** A memory's strength ∈ [0,1]: a blend of activation (recency, 0..1 — spec 12) and
 *  emotional intensity (0..1). Higher = more alive → drawn closer to the self star. */
export function strength(activation: number, intensity: number): number {
  return clamp01(W_ACT * clamp01(activation) + W_INT * clamp01(intensity))
}

/** Strength → distance from the centre: strength 1 → R_MIN (beside the self star),
 *  strength 0 → R_MAX (the dormant outer reaches), linear in between. */
export function targetRadius(strength: number): number {
  return R_MIN + (R_MAX - R_MIN) * (1 - clamp01(strength))
}

/** Fibonacci-sphere position for star i of n; the radius varies by the star's seed so
 *  stars spread across a shell rather than a single sphere. */
export function fibonacciStarPosition(i: number, n: number, seed: number): [number, number, number] {
  const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0
  const rAtY = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = GOLDEN * i
  const r = 22 + seed * 24
  return [Math.cos(theta) * rAtY * r, y * r, Math.sin(theta) * rAtY * r]
}
