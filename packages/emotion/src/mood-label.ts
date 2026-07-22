import { m } from '@cosimosi/i18n'

import type { Mood } from './mood.ts'

// The localized display label for each of the 13 moods, used wherever the write flow shows a
// memory's primary emotion (list + picker). Copy is i18n message content; this only maps the
// domain enum to its `m.*` message so no slice hardcodes a mood name.
const MOOD_LABELS: Record<Mood, () => string> = {
  JOY: m.mood_joy,
  CALM: m.mood_calm,
  SAD: m.mood_sad,
  ANGER: m.mood_anger,
  FEAR: m.mood_fear,
  LOVE: m.mood_love,
  NEUTRAL: m.mood_neutral,
  EXCITEMENT: m.mood_excitement,
  GRATITUDE: m.mood_gratitude,
  RELIEF: m.mood_relief,
  STRESS: m.mood_stress,
  TIRED: m.mood_tired,
  EMPTINESS: m.mood_emptiness,
}

// Accepts the bare mood string carried on the wire; an unknown value (corrupt DTO) falls back to
// the neutral label rather than leaking a raw enum token into the UI.
export function moodLabel(mood: string): string {
  const label = MOOD_LABELS[mood as Mood]
  return (label ?? m.mood_neutral)()
}
