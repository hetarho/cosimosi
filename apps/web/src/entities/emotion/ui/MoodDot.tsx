import { moodColor, type Mood } from '@cosimosi/emotion'

// entities/emotion ui: an `Emotion` as a bare dot, for the places a chip would be too much — beside a
// field label, in a dense row, under a calendar day. Decorative by construction: the colour is the
// emotion package's projection and the meaning always sits in the words next to it (UI-34), so a
// reader who cannot see the hue loses nothing. `MoodChip` is the labelled form. `muted` dims a dot
// that stands for an option not chosen.
export function MoodDot({
  mood,
  size = 'md',
  muted = false,
}: {
  mood: string
  size?: 'sm' | 'md'
  muted?: boolean
}) {
  return (
    <span
      aria-hidden
      className={`${size === 'sm' ? 'size-2' : 'size-2.5'} shrink-0 rounded-full ${muted ? 'opacity-40' : ''}`}
      style={{ backgroundColor: moodColor(mood as Mood) }}
    />
  )
}
