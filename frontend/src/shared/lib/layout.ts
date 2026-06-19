// Deterministic Fibonacci-sphere star layout. Pure math (no three/React/DOM) so the
// star renderer and the camera fly-to read the SAME formula and agree on each star's position.
import { VALUES } from '@/shared/config'
import { clamp01 } from './num'
import { mulberry32 } from './prng'

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

// Self-anchored radial layout (spec 38). A memory's DISTANCE from the central "나" star
// encodes its STRENGTH; its DIRECTION still emerges from the connection graph. Pure math
// (no three/React/DOM) so the layout controller and the renderer agree.
/** Strongest memory shell — sits just outside the self star, near the centre. */
export const R_MIN = VALUES.radialLayout.rMin
/** Weakest (dormant) memory shell — the outer reaches of the universe. Kept inside the
 *  camera's star-shell framing (~46) so the cloud reads tight, not sprawling. */
export const R_MAX = VALUES.radialLayout.rMax

/** Bjork retrieval strength R ∈ [0,1] → distance from the centre: R 1 → R_MIN (beside the
 *  self star), R 0 → R_MAX (the dormant outer reaches), linear in between. "Distance =
 *  strength" preserved (spec 38); spec 07 swapped the old activation·intensity blend for the
 *  single retrieval strength R (entities/memory weight.ts) — a recalled memory is pulled in,
 *  a forgotten one drifts out, and an often-recalled one stays central longer (τ grows with S). */
export function targetRadius(r: number): number {
  return R_MIN + (R_MAX - R_MIN) * (1 - clamp01(r))
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

/** Per-night tangential rotation of a star's DIRECTION (representational drift, spec 40).
 *  ~0.08 rad ≈ 4.6° per night — slow enough to read as drift, not spin. Hand-tuned. */
export const DRIFT_STEP_RAD = VALUES.radialLayout.driftStepRad

/** Deterministic unit-sphere direction from a star's own seed. Unlike fibonacciStarPosition's
 *  golden-angle-by-INDEX placement (successive stars march along a spiral arc), this maps the
 *  star's seed to a scattered point, so adding stars one by one does NOT trace a spiral (spec 40).
 *  Magnitude is 1 — the caller scales it onto the strength-radius shell (atRadius). The seed is
 *  `seedFromId` output = k/2³² for a 32-bit FNV hash k; `seed·2³²` recovers k exactly (k/2³² is
 *  exact for a power-of-two divisor), and mulberry32's avalanche decorrelates adjacent k — so
 *  neighboring-hash stars get distinct directions. (A sub-2³² multiplier would COMPRESS the seed
 *  and collapse adjacent hashes onto the same direction.) */
export function scatterDirection(seed: number): [number, number, number] {
  const rng = mulberry32(Math.floor(seed * 4294967296))
  const theta = 2 * Math.PI * rng()
  const z = 2 * rng() - 1 // cosφ uniform in [-1,1] → uniform on the sphere
  const rAtZ = Math.sqrt(Math.max(0, 1 - z * z))
  return [rAtZ * Math.cos(theta), rAtZ * Math.sin(theta), z]
}

/** Rotate `pos` about a FIXED per-seed axis by `nights·DRIFT_STEP_RAD`, PRESERVING |pos| (radius
 *  = strength, spec 38) and changing only the DIRECTION — representational drift as a slow
 *  per-night angular wander (spec 40). The axis is `scatterDirection(seed)` — fixed (independent
 *  of pos) so the drift forms a clean rotation GROUP: `applyAngularDrift(pos, seed, N)` equals N
 *  successive single-night calls (rotations about one axis commute and add), so a demo time-skip
 *  of N days lands a star exactly where N real nights would (skip == wait, path-independent). The
 *  axis varies per star → different great circles → stars drift independently (well-connected
 *  clusters are partly restored by their links, isolated stars drift freely). Full Rodrigues keeps
 *  |pos| exact for any axis (the axis is generally NOT ⊥ pos). */
export function applyAngularDrift(
  pos: readonly [number, number, number],
  seed: number,
  nights: number,
): [number, number, number] {
  const angle = nights * DRIFT_STEP_RAD
  if (angle === 0) return [pos[0], pos[1], pos[2]]
  const [ax, ay, az] = scatterDirection(seed) // unit axis, fixed for this star (pos-independent)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  // Rodrigues: v_rot = v·c + (axis × v)·s + axis·(axis·v)·(1 − c). |v_rot| = |v| for any unit axis.
  const dot = ax * pos[0] + ay * pos[1] + az * pos[2]
  const cx = ay * pos[2] - az * pos[1]
  const cy = az * pos[0] - ax * pos[2]
  const cz = ax * pos[1] - ay * pos[0]
  const k = dot * (1 - c)
  return [pos[0] * c + cx * s + ax * k, pos[1] * c + cy * s + ay * k, pos[2] * c + cz * s + az * k]
}
