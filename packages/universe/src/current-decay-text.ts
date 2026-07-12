import { decayStage, effectiveElapsedDays, effectiveStrength } from '@cosimosi/memory-logic'

import type { EpisodicMemory } from '@cosimosi/memory'

// Resolve a memory's current forgetting state from stored facts + universe time (§3.4, read-only).
// The decay math is owned by @cosimosi/memory-logic (golden-parity with the server); this only reads
// the resolved stage and picks the matching stored text. Recall resets the anchors, so after a recall
// read the stage drops to 0 and the whole text returns — recovery is a pure re-render ([F5][I8]).

// currentDecayStage is the discrete forgetting stage a memory has reached now (0 = vivid). Shared by
// the panel/label text and the forgetting-degree meta so dimming and word-loss read consistently [F1].
export function currentDecayStage(memory: EpisodicMemory, universeTime: string | null): number {
  const elapsed = effectiveElapsedDays(
    universeTime,
    memory.lastRecalledUniverseTime,
    memory.createdUniverseTime,
    memory.forgettingOffsetDays,
  )
  return decayStage(
    elapsed,
    memory.emotion.arousal,
    effectiveStrength(memory.baseStrength, memory.recallCount),
  )
}

// currentDecayText is the current-memory text as it now reads: the whole text while vivid (stage 0),
// else the persisted stage-`stage` word-loss string (decayStages holds the decayed stages 1..N, so
// stage s reads decayStages[s-1]). It falls back to the whole current text when that stage string is
// not yet persisted (the advance-time hook fills stage texts later) — never inventing erosion [R8a].
export function currentDecayText(memory: EpisodicMemory, universeTime: string | null): string {
  const stage = currentDecayStage(memory, universeTime)
  if (stage <= 0) return memory.currentText
  return memory.decayStages[stage - 1] ?? memory.currentText
}
