import { moodColor, type Mood } from '@cosimosi/emotion'
import { Badge } from '@cosimosi/ui'

import { moodLabel } from '../../../shared/i18n/index.ts'

// entities/episodic-memory ui: a memory's primary `Emotion`, as a chip. The mood label always
// travels with its colour and never the colour alone — the dot is decorative, the word is the cue
// (design-language §2.3). The hue is the emotion package's mood→colour projection, read here and
// never re-derived: a surface that invented its own mapping would show a colour the universe does
// not use. It is data on the page, not chrome — no chrome role is tinted by it.
export function MoodChip({ mood }: { mood: string }) {
  return (
    <Badge variant="neutral">
      <span
        aria-hidden
        className="badge-dot"
        style={{ backgroundColor: moodColor(mood as Mood) }}
      />
      {moodLabel(mood)}
    </Badge>
  )
}
