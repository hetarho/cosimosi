import { VALUES } from '@cosimosi/config'
import { moodColor } from '@cosimosi/emotion'
import { SEMANTIC_MAX_STAGE, effectiveStrength, gistZOffset } from '@cosimosi/memory-logic'

import type { EpisodicMemory } from '@cosimosi/memory'

import { hexToLinearRgb, lerpClamp } from './star-channels.ts'

// The pure projection of a memory's gist onto one neocortical body (§3.4): ONE instance per
// risen memory, whose z and softness read its CURRENT stage. A trace transforms into its gist
// rather than accumulating one body per rung — a memory at semanticStage = N shows a single star
// that has risen N times, not N stars (CLS: one gradually-consolidated neocortical
// representation; trace transformation: no earlier gist persists as a separately retrievable
// object). The stage texts still persist and 변천사 still lists every crossed rung — what changed
// is how many bodies the sky shows, not what is remembered ([C6][C7]).
//
// Position: the FULL (x, y, z) rides the live hippocampal sim buffer per frame (copied, never
// simulated for the neocortex — [C6][I5]); only the stage's z LIFT is
// carried here, derived through the golden-parity gistZOffset — no parallel z math, so a stage rise
// moves the one body further upward while it keeps shadowing its memory's spot in the lens. Color =
// the memory's emotion via the single palette seam and nothing else ([M3][I3]); size =
// EffectiveStrength mapped into the quieter gist range ([V3]); softness = the [V5] diffuse look,
// deepening with stage. No `three`, no rendering-vocab dependency — deterministic functions over
// domain facts.

export interface GistStarInstance {
  readonly memoryId: string
  /** The memory's current stage (1..SEMANTIC_MAX_STAGE) — what this one body has risen to. */
  readonly stage: number
  /** The selection id a pick emits — parseGistNodeId round-trips it ([R8]). */
  readonly nodeId: string
  /** The stage's z lift (gistZOffset) — added to the live hippocampal (x, y, z) per frame. */
  readonly zOffset: number
  /** Emotion color, linear RGB 0..1 ([M3][I3]). */
  readonly color: readonly [number, number, number]
  /** World scale from EffectiveStrength within [gistStarSizeMin, gistStarSizeMax] ([V3]). */
  readonly size: number
  /** Diffuse softness 0..1 — the base gist look, deepening toward 1 at the ladder top ([V5]). */
  readonly softness: number
}

// A gist body's selection id. Everything after the prefix is the memory id, so an id containing
// ':' parses back whole. No stage part: a memory has one gist body, and which rung it currently
// shows is the server's to decide at read time — an id that named a stage would let a pick address
// a depth the memory may already have left.
const GIST_NODE_PREFIX = 'gist:'

export function gistNodeId(memoryId: string): string {
  return `${GIST_NODE_PREFIX}${memoryId}`
}

// Recognizes a gist selection id and returns its memory — the recognizer the star-detail resolver
// injects so gist picks route to the paid view without the resolver knowing this format ([R8]).
// Anything malformed reads as "not a gist body".
export function parseGistNodeId(nodeId: string): { episodicMemoryId: string } | null {
  if (!nodeId.startsWith(GIST_NODE_PREFIX)) return null
  const episodicMemoryId = nodeId.slice(GIST_NODE_PREFIX.length)
  if (!episodicMemoryId) return null
  return { episodicMemoryId }
}

export function gistStageOffset(stage: number): number {
  return gistZOffset(stage)
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
    instances.push({
      memoryId: memory.id,
      stage: risen,
      nodeId: gistNodeId(memory.id),
      // A lift, not a coordinate: the renderer adds it to the live (x, y, z) it reads from the
      // sim buffer per frame; the lift derivation stays the golden-parity `gistZOffset`'s alone
      // ([I5]).
      zOffset: gistStageOffset(risen),
      color,
      size,
      // Stage 1 reads at the base gist softness; the ladder top reads fully diffuse ([V5]).
      softness: lerpClamp(rendering.gistStarDiffuse, 1, (risen - 1) / (SEMANTIC_MAX_STAGE - 1)),
    })
  }
  return instances
}
