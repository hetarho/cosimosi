// Self-anchored radial layout (spec 38) — the SINGLE source of the star-graph layout math shared
// by the live single-universe canvas (LiveLayoutController) and the spec-37 overlay (OverlayUniverse).
// Both place stars on strength shells and run the same force-sim params, so a tuning change here moves
// both in lock-step (no silent divergence between "내 우주" and the overlay's copy of it). Pure TS —
// composes shared/lib (strength·targetRadius); no three/React/DOM (헌법4).
import { memoryRadiusR, radiusConnectedness } from '@/entities/memory'
import { VALUES } from '@/shared/config'
import { targetRadius } from '@/shared/lib'
import type { SimParams } from '@/shared/lib/force-sim'

/** A memory's target distance from the central self star (spec 38·07, change 18): the Bjork
 *  retrieval strength R → radius. Strong/fresh → near centre, faded → outer; an often-recalled
 *  memory stays central longer (τ grows with the storage strength S). CONNECTIVITY (degreeNorm +
 *  Σweight, from the synapse graph) extends τ so well-connected memories drift out more slowly —
 *  links pull toward the centre, never push out (connectedness=0 → pure time-decay radius). The
 *  caller supplies the normalized degree/Σweight (degreeNormById/weightedDegreeById); the angle/
 *  direction is still the connection graph — only the radius reads strength + connectivity. */
export function radiusOf(
  mem: { lastRecalledAt: number; intensity: number; recallCount: number },
  now: number,
  degreeNorm = 0,
  weightedDegreeNorm = 0,
): number {
  const conn = radiusConnectedness(degreeNorm, weightedDegreeNorm)
  return targetRadius(memoryRadiusR(mem.recallCount, mem.intensity, mem.lastRecalledAt, now, conn))
}

/** Scale a seed position onto a target-radius shell, keeping its direction (so a star rises at its
 *  cluster's angle but at its strength's distance). Origin-degenerate → fixed axis (stable normalize). */
export function atRadius(pos: readonly [number, number, number], r: number): [number, number, number] {
  const len = Math.hypot(pos[0], pos[1], pos[2])
  if (len < 1e-3) return [r, 0, 0]
  const k = r / len
  return [pos[0] * k, pos[1] * k, pos[2] * k]
}

/** Force-sim params tuned for the strength-shelled universe (spec 38/40) — shared by both canvases. */
export const RADIAL_SIM_PARAMS: Partial<SimParams> = { repulsion: VALUES.radialLayout.repulsion, linkDistance: VALUES.radialLayout.linkDistance, radialStrength: VALUES.radialLayout.radialStrength }
