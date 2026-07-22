import { toEmotionSlices, type EmotionSlice, type Mood } from '@cosimosi/emotion'

import type { EpisodicMemory } from '@cosimosi/memory'

// The emotions PRESENT in a universe, as normalized shares — the input the enclosing emotion sky
// paints ([I3]: emotion drives color only). Each memory contributes its mood one vote, so an
// emotion's share of the sky is its share of the remembered moments; colors come only through the
// palette seam (`moodColor` inside the slice builder). Pure projection — reads the memories,
// writes nothing.
export function universeEmotionSlices(memories: readonly EpisodicMemory[]): EmotionSlice[] {
  const counts = new Map<Mood, number>()
  for (const memory of memories) {
    const mood = memory.emotion.mood
    counts.set(mood, (counts.get(mood) ?? 0) + 1)
  }
  return toEmotionSlices(counts)
}
