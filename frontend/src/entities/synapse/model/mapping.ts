// Pure weight·brightness → visual-parameter mapping (spec 09, Architecture §6).
// Testable, three-free (constitution §4). Line2NodeMaterial has no per-edge width,
// so strength is carried by emissive/alpha/pulse, not thickness.
import type { SynapseEdge } from './types'

export const A_MIN = 0.05

// Thickness buckets (a 2-step global scalar — Line2NodeMaterial can't vary width per edge).
export const WIDTH_THIN_PX = 1
export const WIDTH_THICK_PX = 4
export const THICK_THRESHOLD = 0.5 // weight ≥ 0.5 → thick bucket

export const ALPHA_MIN = 0.15 // weak/dormant edges still glow faintly (constitution §2)
export const ALPHA_MAX = 1

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Effective visual strength = weight · max(a_min, brightness) (Architecture §6),
 *  clamped to [0,1] so a stray weight/brightness > 1 (e.g. from spec 12) can't blow
 *  out alpha/color on the additive material. */
export const visualIntensity = (e: SynapseEdge): number =>
  Math.min(1, Math.max(0, e.weight) * Math.max(A_MIN, e.brightness))

/** Emissive brightness driver. */
export const emissive = (e: SynapseEdge): number => visualIntensity(e)

/** Opacity driver, floored at ALPHA_MIN so weak/dormant edges remain visible (1.4). */
export const alpha = (e: SynapseEdge): number => lerp(ALPHA_MIN, ALPHA_MAX, visualIntensity(e))

/** Pulse amplitude for sin(time·f)·amp — recently-reinforced edges pulse stronger. */
export const pulseAmp = (e: SynapseEdge): number => e.reinforcedRecency

/** Thickness can't be modulated per edge → return a bucket key (optional 2-group render). */
export const widthBucket = (e: SynapseEdge): 'thin' | 'thick' =>
  e.weight >= THICK_THRESHOLD ? 'thick' : 'thin'

export const bucketWidthPx = (b: 'thin' | 'thick'): number =>
  b === 'thick' ? WIDTH_THICK_PX : WIDTH_THIN_PX
