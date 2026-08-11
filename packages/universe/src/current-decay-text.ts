import {
  REDACTION_TOKEN,
  decayStage,
  effectiveElapsedDays,
  effectiveStrength,
} from '@cosimosi/memory-logic'

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

/** One stretch of the current-memory text: still legible, or a run that has gone. */
export interface DecayTextSpan {
  readonly text: string
  readonly lost: boolean
}

// currentDecaySpans is the same text, cut into the runs a renderer has to treat differently: the
// words that survive, and the redaction tokens standing where words were removed. Which runs are
// gone is decided by the decay algorithm and travels in the stored string; WHAT a lost run looks
// like belongs to the presentation layer, and this is the seam between the two.
//
// Consecutive lost words are coalesced into ONE span, whitespace and all, so a long erasure reads as
// a single smear rather than as a row of identical marks. The kept words are handed over untouched —
// nothing is reconstructed from `currentText`, which the stored stages are not re-derived from when
// reconsolidation rewrites it, and which would leak the very words forgetting took ([R8a][F2]).
//
// A vivid memory is one legible span whatever it says. The stage decides that, not the characters:
// the text at stage 0 is the diarist's own, never the algorithm's output, so a writer who typed the
// token themselves reads back exactly what they wrote.
export function currentDecaySpans(
  memory: EpisodicMemory,
  universeTime: string | null,
): readonly DecayTextSpan[] {
  const text = currentDecayText(memory, universeTime)
  if (!text) return []
  if (currentDecayStage(memory, universeTime) <= 0) return [{ text, lost: false }]
  // Split KEEPING the separators, so the gaps between words survive into the rendered line.
  const pieces = text.split(/(\s+)/).filter((piece) => piece !== '')
  const isGap = (piece: string) => /^\s+$/.test(piece)
  // A gap belongs to the erasure only when it sits BETWEEN two removed words; the space before the
  // next legible word is that word's, so a smear never runs past the loss it stands for.
  const lostAt = pieces.map((piece, index) =>
    isGap(piece)
      ? pieces[index - 1] === REDACTION_TOKEN && pieces[index + 1] === REDACTION_TOKEN
      : piece === REDACTION_TOKEN,
  )
  const spans: DecayTextSpan[] = []
  pieces.forEach((piece, index) => {
    const previous = spans[spans.length - 1]
    if (previous && previous.lost === lostAt[index]) {
      spans[spans.length - 1] = { text: previous.text + piece, lost: previous.lost }
      return
    }
    spans.push({ text: piece, lost: Boolean(lostAt[index]) })
  })
  return spans
}
