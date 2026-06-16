// Hot-cluster initial placement for a new fragment star (spec 22). Pure math — no
// three / React / DOM (constitution §4) — so the mobile renderer reuses it. A new star
// should rise NEXT TO the recently-active ("hot", high-excitability) constellation it
// links into, not in empty space, so its coordinate visibly emerges from the graph
// (concept §결정2). The server has already biased the new star's LINKS toward the hot
// cluster (worker biasedLinks); this seeds the starting position the same way so the
// force relaxation reads as a pull toward "요즘의 나", not a slow drift from the origin.
import { mulberry32 } from '../prng'
import { VALUES } from '@/shared/config'

/** Deterministic 32-bit FNV-1a hash (shared idiom — keeps seeding pure/reproducible). */
function hashId(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A small deterministic ±jitter (≈±1.5) from the node id, so sibling fragments seeded
 *  at the same centroid don't start exactly coincident (which the spring force can't
 *  separate cleanly). */
function jitter(id: string): [number, number, number] {
  const rng = mulberry32(hashId(id))
  return [(rng() - 0.5) * 3, (rng() - 0.5) * 3, (rng() - 0.5) * 3]
}

/** One new star's neighbor: an already-placed star it links to, and that star's heat
 *  (recency 0..1 — hotter = more recently recalled/written). */
export interface SeedNeighbor {
  id: string
  heat: number
}

/** Initial position for ONE new fragment star: a heat-weighted blend of its placed
 *  neighbors' positions (so the hottest neighbor's cluster centroid dominates — the
 *  argmax-e seed of acceptance 1.6), plus deterministic jitter. Cold neighbors still
 *  contribute a little (a floor weight) so the seed stays inside the linked cluster
 *  rather than snapping onto a single star. Falls back to `fallback` (the fibonacci
 *  shell seed) when the star has no placed neighbor yet — e.g. an optimistic star whose
 *  links haven't arrived from the server. */
export function seedNearCluster(
  nodeId: string,
  neighbors: SeedNeighbor[],
  positionOf: (id: string) => readonly [number, number, number] | null,
  fallback: readonly [number, number, number],
): [number, number, number] {
  let wsum = 0
  let sx = 0
  let sy = 0
  let sz = 0
  for (const n of neighbors) {
    const p = positionOf(n.id)
    if (!p) continue
    // floor so every linked cluster pulls a bit; the hottest neighbor dominates.
    const w = VALUES.forceSim.seedHeatFloor + Math.max(0, n.heat)
    wsum += w
    sx += p[0] * w
    sy += p[1] * w
    sz += p[2] * w
  }
  const j = jitter(nodeId)
  if (wsum === 0) {
    return [fallback[0] + j[0], fallback[1] + j[1], fallback[2] + j[2]]
  }
  return [sx / wsum + j[0], sy / wsum + j[1], sz / wsum + j[2]]
}
