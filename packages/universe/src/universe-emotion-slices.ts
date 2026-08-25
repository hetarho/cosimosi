import { toEmotionSlices, type EmotionSlice, type Mood } from '@cosimosi/emotion'
import { effectiveStrength } from '@cosimosi/memory-logic'

import type { EpisodicMemory } from '@cosimosi/memory'

// The emotions a universe carries, as normalized shares — the input the enclosing emotion sky paints
// ([I3]: emotion drives color only). Each memory weighs in with its EffectiveStrength, the read-time
// size that recall accumulation grows ([R3]), which is what makes the sky [M5]'s mirror: the feeling
// a writer keeps returning to claims more of it than one merely written down and left. A count would
// make the sky the average of what was written, which is the reading [M5] exists to deny.
//
// EffectiveStrength is also the weight the nebula gives a memory's bleed, so the two colour surfaces
// cannot disagree about what one memory is worth. Colours come only through the palette seam
// (`moodColor` inside the slice builder). Pure projection — reads the memories, writes nothing.
export function universeEmotionSlices(memories: readonly EpisodicMemory[]): EmotionSlice[] {
  const weights = new Map<Mood, number>()
  for (const memory of memories) {
    const mood = memory.emotion.mood
    weights.set(
      mood,
      (weights.get(mood) ?? 0) + effectiveStrength(memory.baseStrength, memory.recallCount),
    )
  }
  return toEmotionSlices(weights)
}
