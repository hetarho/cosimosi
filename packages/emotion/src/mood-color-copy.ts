import { m } from '@cosimosi/i18n'

import { moodLabel } from './mood-label.ts'
import type { MoodColorPreset } from './mood-color-preset.ts'
import type { MoodColorConcern } from './mood-color-risk.ts'

// What `mood-label.ts` does for the thirteen feelings, for the two closed sets the colour editor
// works in. It sits beside the unions rather than in a slice so both surfaces that offer colours —
// the first-run sky and the My-page tab — read one exhaustive projection.

/** What a preset button says it is. */
export function moodColorPresetTitle(preset: MoodColorPreset): string {
  switch (preset.kind) {
    case 'AUTHORED':
      return m.palette_preset_authored()
    case 'POPULAR':
      // Past the top one the rank has to be spoken, or every slot below first reads identically.
      return preset.rank === 1
        ? m.palette_preset_popular_first()
        : m.palette_preset_popular_rank({ rank: String(preset.rank) })
    case 'RANDOM':
      return m.palette_preset_random()
  }
}

/**
 * The line under a preset's title, or nothing.
 *
 * A share belongs to the whole hue bucket, and the swatch is only that bucket's most common member —
 * so the copy says "a colour like this", not "this colour". Rounded to whole percent, which can print
 * two buckets identically; the row's order is what separates them.
 */
export function moodColorPresetDetail(preset: MoodColorPreset): string | undefined {
  switch (preset.kind) {
    case 'AUTHORED':
      return preset.share === undefined ? undefined : shareText(preset.share)
    case 'POPULAR':
      return shareText(preset.share)
    case 'RANDOM':
      return m.palette_preset_random_hint()
  }
}

function shareText(share: number): string {
  return m.palette_preset_share({ percent: String(Math.round(share * 100)) })
}

/**
 * The sentence one concern shows. Each names the cause and then what it costs in the universe — that
 * is where these colors are seen, and a warning that only says a color is "too bright" gives a reader
 * nothing to decide with.
 *
 * SIMILAR needs the other feeling's name, so it is read off the concern rather than passed
 * separately; a SIMILAR concern always carries one (`moodColorRisks` only raises it with a match).
 */
export function moodColorRiskText(concern: MoodColorConcern): string {
  switch (concern.risk) {
    case 'GLARE':
      return m.palette_risk_glare()
    case 'DIM':
      return m.palette_risk_dim()
    case 'FAINT':
      return m.palette_risk_faint()
    case 'SIMILAR':
      return m.palette_risk_similar({ mood: concern.otherMood ? moodLabel(concern.otherMood) : '' })
  }
}
