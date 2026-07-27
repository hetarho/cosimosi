import { moodColor, type Mood } from '@cosimosi/emotion'

// entities/episodic-memory ui: a memory's `Emotion` as a bare dot, for the places a chip would be too
// much — beside a field label, in a dense row. Decorative by construction: the colour is the emotion
// package's projection and the meaning always sits in the words next to it (design-language §2.3), so
// a reader who cannot see the hue loses nothing. `MoodChip` is the labelled form.
export function MoodDot({ mood }: { mood: string }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: moodColor(mood as Mood) }}
    />
  )
}
