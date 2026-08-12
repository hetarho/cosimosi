import { clampChromaToGamut } from './gamut.ts'
import { nearestEmotionStep } from './mood-color.ts'
import { colorToOkLch, okLchToColor, type OkLch } from './oklab.ts'
import type { Color } from './palette.ts'

/**
 * A colour being chosen, held in both forms at once: `color` is saved and previewed, `lch` is what
 * the controls sit on.
 *
 * Both are stored because a hex is 8 bits per channel — deriving the OkLCH from it on every render
 * would let an untouched control drift, and would stop a preset's exact colour comparing equal to
 * itself. A preset keeps its hex verbatim; a control move owns the OkLCH.
 */
export interface MoodColorDraft {
  readonly color: Color
  readonly lch: OkLch
}

/** The draft a saved or preset colour opens as. Its lightness is read onto its own step. */
export function draftFromColor(color: Color): MoodColorDraft {
  const lch = colorToOkLch(color)
  return { color, lch: { ...lch, l: nearestEmotionStep(lch.l) } }
}

/** The draft a control move produces: chroma held inside the gamut, then rendered to a hex. */
export function draftFromOkLch(lch: OkLch): MoodColorDraft {
  const clamped = clampChromaToGamut(lch)
  return { color: okLchToColor(clamped), lch: clamped }
}
