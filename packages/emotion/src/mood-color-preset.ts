import { VALUES } from '@cosimosi/config'

import { maxChromaInGamut } from './gamut.ts'
import { EMOTION_LIGHTNESS_STEPS } from './mood-color.ts'
import { moodColorRisks } from './mood-color-risk.ts'
import type { Mood } from './mood.ts'
import { okLchToColor } from './oklab.ts'
import { defaultMoodPalette, type Color } from './palette.ts'

/**
 * One aggregate hue bucket as the account service reports it. The list arrives ranked — most chosen
 * first, ties broken by which bucket the aggregate saw first — and is consumed in that order.
 */
export interface MoodColorBucketStat {
  readonly bucket: number
  readonly color: Color
  /** The bucket's fraction of the choices made for this mood. A bucket standing alone is 1. */
  readonly share: number
}

/**
 * One offer in a mood's preset row.
 *
 *   AUTHORED  the colour the product gives this feeling;
 *   POPULAR   an aggregate-backed colour, ranked;
 *   RANDOM    carries no colour — it mints one when pressed.
 *
 * Both coloured kinds carry the share of choices their hue bucket holds. The authored one's is
 * optional: a colour nobody has explicitly saved has no aggregate row, and no share to state.
 */
export type MoodColorPreset =
  | { readonly kind: 'AUTHORED'; readonly color: Color; readonly share?: number }
  | {
      readonly kind: 'POPULAR'
      readonly color: Color
      /** 1-based, among the popular presets only — "the most chosen", then the next. */
      readonly rank: number
      readonly share: number
    }
  | { readonly kind: 'RANDOM' }

/**
 * The preset row for one mood: authored first, up to `palette.popular_preset_count` aggregate
 * colours in the order given, random last.
 *
 * The authored colour's own bucket is read out of the same pool for its share and then skipped in
 * the ranked slots, so the row never shows one colour twice — which is why the stats query returns
 * more candidates than there are popular slots. A mood with no aggregate simply yields fewer
 * buttons.
 */
export function moodColorPresets(
  mood: Mood,
  stats: readonly MoodColorBucketStat[],
): readonly MoodColorPreset[] {
  const authored = defaultMoodPalette.colors[mood]
  const authoredShare = stats.find((stat) => stat.color === authored)?.share
  const popular: Extract<MoodColorPreset, { kind: 'POPULAR' }>[] = []
  for (const stat of stats) {
    if (stat.color === authored) continue
    if (popular.some((preset) => preset.color === stat.color)) continue
    popular.push({
      kind: 'POPULAR',
      color: stat.color,
      rank: popular.length + 1,
      share: stat.share,
    })
    if (popular.length === VALUES.palette.popularPresetCount) break
  }
  return [
    {
      kind: 'AUTHORED',
      color: authored,
      ...(authoredShare === undefined ? {} : { share: authoredShare }),
    },
    ...popular,
    { kind: 'RANDOM' },
  ]
}

// The risk bands cover a couple of percent of the reachable space each, so a clean draw is near
// certain well inside this bound.
const RANDOM_ATTEMPTS = 12
// Chroma is drawn from the upper part of what the hue and step can hold, keeping every throw clear
// of the near-neutral end.
const RANDOM_CHROMA_FLOOR_FRACTION = 0.55

/**
 * A colour on the emotion lightness steps, drawn at random and re-drawn while it lands in a risk
 * band. `random` is injectable so a test can pin the throw.
 *
 * If every attempt is risky the first draw is returned rather than nothing; the editor's live notice
 * covers it.
 */
export function randomMoodColor(mood: Mood, random: () => number = Math.random): Color {
  let first: Color | undefined
  for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt += 1) {
    const candidate = sampleColor(random)
    first ??= candidate
    if (moodColorRisks(mood, candidate).length === 0) return candidate
  }
  // `first` is assigned on the first iteration; RANDOM_ATTEMPTS is a positive literal.
  return first as Color
}

function sampleColor(random: () => number): Color {
  const step =
    EMOTION_LIGHTNESS_STEPS[Math.floor(random() * EMOTION_LIGHTNESS_STEPS.length)] ??
    EMOTION_LIGHTNESS_STEPS[0]
  const hue = random() * 360
  const ceiling = maxChromaInGamut(step, hue)
  const floor = ceiling * RANDOM_CHROMA_FLOOR_FRACTION
  return okLchToColor({ l: step, c: floor + random() * (ceiling - floor), h: hue })
}
