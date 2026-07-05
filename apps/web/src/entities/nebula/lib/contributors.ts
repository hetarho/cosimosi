import { VALUES } from '@cosimosi/config'
import { moodColor } from '@cosimosi/emotion'
import { effectiveStrength } from '@cosimosi/memory-logic'

import type { EpisodicMemory } from '../../episodic-memory/@x/nebula.ts'

// The packed per-contributor buffer the ColorField layer draws: parallel arrays indexed 0..count.
export interface NebulaContributors {
  readonly count: number
  /** Absolute coordinate-buffer node index for each drawn contributor (memories may be a subset). */
  readonly nodeIndices: Int32Array
  /** Per-contributor emotion color, linear RGB (stride 3). */
  readonly tints: Float32Array
  /** Per-contributor bleed radius in world units. */
  readonly radii: Float32Array
}

export interface ContributorParams {
  /** Buffer node index of the first memory — memories occupy [firstNodeIndex, firstNodeIndex+len). */
  readonly firstNodeIndex: number
}

// Pure contributor selection/packing for the emotion color field (§3.4, one-way projection). Each
// rendered memory bleeds its mood color — obtained ONLY through the plan-17 palette seam
// (`moodColor`), the single color path — with a bleed radius weighted by its EffectiveStrength: the
// derived read-time size (base strength + recall accumulation), read here, never re-derived from raw
// base strength. When the field is over the contributor budget the STRONGEST memories are kept — a
// stronger star bleeds wider and owns more of the emergent tone. Input order is store order, so index
// i maps to buffer node `firstNodeIndex + i` (matching the star layer); the projection reads emotion
// for color and derived strength for radius, nothing else, and emits nothing into the domain [I3][M7].
export function buildContributors(
  memories: readonly (EpisodicMemory | undefined)[],
  { firstNodeIndex }: ContributorParams,
): NebulaContributors {
  const { nebula } = VALUES
  const scored: { nodeIndex: number; mood: EpisodicMemory['emotion']['mood']; radius: number }[] = []
  memories.forEach((memory, index) => {
    if (!memory) return
    const strength = clamp01(effectiveStrength(memory.baseStrength, memory.recallCount))
    scored.push({
      nodeIndex: firstNodeIndex + index,
      mood: memory.emotion.mood,
      radius: Math.max(nebula.minBleedRadius, nebula.bleedRadiusCoefficient * strength),
    })
  })
  scored.sort((a, b) => b.radius - a.radius)
  const count = Math.min(scored.length, nebula.maxContributors)
  const nodeIndices = new Int32Array(Math.max(1, count))
  const tints = new Float32Array(Math.max(1, count) * 3)
  const radii = new Float32Array(Math.max(1, count))
  for (let i = 0; i < count; i++) {
    const contributor = scored[i]
    if (!contributor) continue
    nodeIndices[i] = contributor.nodeIndex
    radii[i] = contributor.radius
    const [r, g, b] = hexToLinearRgb(moodColor(contributor.mood))
    tints[i * 3] = r
    tints[i * 3 + 1] = g
    tints[i * 3 + 2] = b
  }
  return { count, nodeIndices, tints, radii }
}

// A non-finite strength (from a skewed/corrupt DTO the domain mapper didn't coerce) floors to 0
// so it reads as the min-radius glow rather than producing a NaN scale that poisons a matrix.
function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

// sRGB `#rrggbb` → linear RGB, matching the star body's conversion so a memory's field glow and
// its star read the same emotion color in the renderer's linear working space.
function hexToLinearRgb(hex: string): [number, number, number] {
  return [
    srgbToLinear(Number.parseInt(hex.slice(1, 3), 16) / 255),
    srgbToLinear(Number.parseInt(hex.slice(3, 5), 16) / 255),
    srgbToLinear(Number.parseInt(hex.slice(5, 7), 16) / 255),
  ]
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
