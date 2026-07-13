import { VALUES } from '@cosimosi/config'
import { moodColor } from '@cosimosi/emotion'
import { SEMANTIC_MAX_STAGE, effectiveStrength, gistCoordinate } from '@cosimosi/memory-logic'

import type { EpisodicMemory } from '@cosimosi/memory'

import { hexToLinearRgb, lerpClamp } from './star-channels.ts'

// The pure projection of a memory's risen gist ladder onto neocortical bodies (§3.4): one
// instance PER risen stage — a memory at semanticStage = N shows N gist stars, and risen
// stages persist ([C6][C7]). Position: x, y ride the live hippocampal sim buffer per frame
// (copied, never simulated for the neocortex [C6][I5]); only the stage's z is carried here,
// derived through the golden-parity gistCoordinate — no parallel z math. Color = the memory's
// emotion via the single palette seam and nothing else ([M3][I3]); size = EffectiveStrength
// mapped into the quieter gist range ([V3]); softness = the [V5] diffuse look, deepening with
// stage. No `three`, no rendering-vocab dependency — deterministic functions over domain facts.

export interface GistStarInstance {
  readonly memoryId: string
  /** The risen stage this body materializes (1..SEMANTIC_MAX_STAGE). */
  readonly stage: number
  /** The selection id a pick emits — parseGistNodeId round-trips it ([R8]). */
  readonly nodeId: string
  /** Neocortical z for the stage (gistCoordinate) — x, y come from the sim buffer per frame. */
  readonly z: number
  /** Emotion color, linear RGB 0..1 ([M3][I3]). */
  readonly color: readonly [number, number, number]
  /** World scale from EffectiveStrength within [gistStarSizeMin, gistStarSizeMax] ([V3]). */
  readonly size: number
  /** Diffuse softness 0..1 — the base gist look, deepening toward 1 at the ladder top ([V5]). */
  readonly softness: number
}

// A gist body's selection id. The stage sits between the fixed prefix and the memory id so a
// memory id containing ':' can never shift the parse — everything after the second ':' is the id.
const GIST_NODE_PREFIX = 'gist:'

export function gistNodeId(memoryId: string, stage: number): string {
  return `${GIST_NODE_PREFIX}${stage}:${memoryId}`
}

// Recognizes a gist selection id and returns its (memory, stage) — the recognizer the
// star-detail resolver injects so gist picks route to the paid view without the resolver
// knowing this format ([R8]). Anything malformed reads as "not a gist body".
export function parseGistNodeId(
  nodeId: string,
): { episodicMemoryId: string; stage: number } | null {
  if (!nodeId.startsWith(GIST_NODE_PREFIX)) return null
  const rest = nodeId.slice(GIST_NODE_PREFIX.length)
  const separator = rest.indexOf(':')
  if (separator <= 0) return null
  const stage = Number.parseInt(rest.slice(0, separator), 10)
  const episodicMemoryId = rest.slice(separator + 1)
  if (!episodicMemoryId || !Number.isInteger(stage) || stage < 1 || stage > SEMANTIC_MAX_STAGE) {
    return null
  }
  return { episodicMemoryId, stage }
}

export function gistStarInstances(
  memories: readonly EpisodicMemory[],
): readonly GistStarInstance[] {
  const { rendering } = VALUES
  const instances: GistStarInstance[] = []
  for (const memory of memories) {
    // A corrupt DTO stage floors to 0 (no body) rather than minting NaN instances; the ladder
    // ceiling is the derived max — there is no stage past it ([C7]).
    const risen = Number.isFinite(memory.semanticStage)
      ? Math.min(Math.max(Math.floor(memory.semanticStage), 0), SEMANTIC_MAX_STAGE)
      : 0
    if (risen < 1) continue
    const color = hexToLinearRgb(moodColor(memory.emotion.mood))
    const size = lerpClamp(
      rendering.gistStarSizeMin,
      rendering.gistStarSizeMax,
      effectiveStrength(memory.baseStrength, memory.recallCount),
    )
    for (let stage = 1; stage <= risen; stage++) {
      instances.push({
        memoryId: memory.id,
        stage,
        nodeId: gistNodeId(memory.id, stage),
        // Only z is taken — the x, y arguments are placeholders because the real x, y are
        // copied from the live sim buffer per frame; the z derivation stays the golden-parity
        // `gistCoordinate`'s alone ([I5]).
        z: gistCoordinate(0, 0, stage).z,
        color,
        size,
        // Stage 1 reads at the base gist softness; the ladder top reads fully diffuse ([V5]).
        softness: lerpClamp(rendering.gistStarDiffuse, 1, (stage - 1) / (SEMANTIC_MAX_STAGE - 1)),
      })
    }
  }
  return instances
}
