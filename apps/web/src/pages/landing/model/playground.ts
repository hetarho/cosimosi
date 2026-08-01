import { arousalToInitialStrength, createEmotion, type Mood } from '@cosimosi/emotion'

import type { EpisodicMemory } from '@cosimosi/memory'

/**
 * The playground's one story, as data: a sentence the visitor wrote, the feeling they chose, and
 * how the resulting memory has been treated since — never anyone's real entry, and never sent
 * anywhere. The page has no session and no transport in reach, so "the playground saved something"
 * is not expressible here, the same guarantee the rest of the landing makes.
 *
 * Everything derived from this goes through the production functions — the channel projection,
 * `effectiveBrightness`, `arousalToInitialStrength` — so what the visitor watches IS the shipped
 * behaviour at the shipped coefficients, not a marketing animation of it.
 */
export interface PlaygroundEntry {
  readonly text: string
  readonly mood: Mood
  readonly recallCount: number
  /** Playground-day of the most recent recall (see `playgroundUniverseTime`), or null if never. */
  readonly lastRecalledDay: number | null
}

/** The playground clock's fixed birth date — day 0 of the slider. Any date works; one is honest. */
export const PLAYGROUND_EPOCH = '2026-01-01'

/** How far the time slider reaches: a year of universe-days, enough to watch the fade find its floor. */
export const PLAYGROUND_MAX_DAYS = 365

/**
 * The feelings on offer. A subset on purpose: the full thirteen-mood wheel belongs to the product;
 * five distinct colours across the valence/arousal range are enough for the story this card tells.
 */
export const PLAYGROUND_MOODS: readonly Mood[] = ['JOY', 'CALM', 'LOVE', 'SAD', 'STRESS']

/** Day n of the playground clock as the ISO universe-time the domain functions read. */
export function playgroundUniverseTime(day: number): string {
  const epochMs = Date.UTC(2026, 0, 1)
  return new Date(epochMs + Math.max(0, Math.round(day)) * 86_400_000).toISOString().slice(0, 10)
}

/**
 * The visitor's entry as the domain sees one. Base strength comes from the chosen mood's arousal
 * via the production rule, so an excited sentence genuinely rises larger than a tired one; the
 * seed comes from the sentence itself, so two different lines get two different seed-forms.
 */
export function playgroundMemory(entry: PlaygroundEntry): EpisodicMemory {
  return {
    id: 'landing-playground',
    name: entry.text,
    emotion: createEmotion(entry.mood),
    baseStrength: arousalToInitialStrength(createEmotion(entry.mood).arousal),
    recallCount: entry.recallCount,
    createdUniverseTime: PLAYGROUND_EPOCH,
    lastRecalledUniverseTime:
      entry.lastRecalledDay === null ? null : playgroundUniverseTime(entry.lastRecalledDay),
    seed: seedFromText(entry.text),
    activations: [],
    decayStages: [],
    forgettingOffsetDays: 0,
    currentText: entry.text,
    semanticStage: 0,
  }
}

// Same modulus as the channel projection's seed normalization, so the whole [0,1) form range is
// reachable from ordinary sentences.
export function seedFromText(text: string): bigint {
  let hash = 0n
  for (const character of text) {
    hash = (hash * 31n + BigInt(character.codePointAt(0) ?? 0)) % 1_000_003n
  }
  return hash
}
