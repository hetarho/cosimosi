// Self-anchored radial layout (spec 38) — the SINGLE source of the star-graph layout math shared
// by the live single-universe canvas (LiveLayoutController) and the spec-37 overlay (OverlayUniverse).
// Both place stars on strength shells and run the same force-sim params, so a tuning change here moves
// both in lock-step (no silent divergence between "내 우주" and the overlay's copy of it). Pure TS —
// composes shared/lib (strength·targetRadius); no three/React/DOM (헌법4).
import { memoryR } from '@/entities/memory'
import { VALUES } from '@/shared/config'
import { targetRadius } from '@/shared/lib'
import type { SimParams } from '@/shared/lib/force-sim'

/** A memory's target distance from the central self star (spec 38·07): the single Bjork
 *  retrieval strength R (from recall_count + intensity + lastRecalledAt) → radius. Strong/fresh
 *  → near centre, faded → outer; an often-recalled memory stays central longer (τ grows with the
 *  storage strength S). Angle/direction is still the connection graph — only the radius is R. */
export function radiusOf(
  mem: { lastRecalledAt: number; intensity: number; recallCount: number },
  now: number,
): number {
  return targetRadius(memoryR(mem.recallCount, mem.intensity, mem.lastRecalledAt, now))
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
