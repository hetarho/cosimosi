import { VALUES } from '@cosimosi/config'
import { describe, expect, it } from 'vitest'

import { checkPaletteAxisConsistency } from './axis-consistency.ts'
import { MOODS, moodCoordinate, type Mood } from './mood.ts'
import { PALETTES } from './registry.ts'
import { defineMoodPalette, type Color } from './palette.ts'

describe('palette axis consistency', () => {
  it('reports no warnings for any shipped registry palette', () => {
    for (const [id, palette] of Object.entries(PALETTES)) {
      const warnings = checkPaletteAxisConsistency(palette)
      expect(warnings, `${id} should be axis-consistent`).toEqual([])
    }
  })

  it('warns when hue contradicts valence beyond the threshold', () => {
    // Positive-valence moods painted cool, negative-valence moods painted warm — a deliberate
    // inversion of the warm=positive / cool=negative axis.
    const cool: Color = '#2a4fd0'
    const warm: Color = '#ff7a30'
    const inverted = defineMoodPalette(
      'inverted-test',
      Object.fromEntries(
        MOODS.map((mood) => [mood, moodCoordinate(mood).valence >= 0 ? cool : warm]),
      ) as Record<Mood, Color>,
    )

    const warnings = checkPaletteAxisConsistency(inverted)

    expect(warnings.length).toBeGreaterThan(0)
    for (const warning of warnings) {
      expect(warning.issue).toBe('valence_hue_mismatch')
      // Every reported warning must clear the generated threshold — the guardrail reads the
      // tolerance from values, never a hard-coded literal.
      expect(warning.severity).toBeGreaterThan(VALUES.palette.axisWarnValenceThreshold)
    }
  })

  it('never flags the neutral mood (zero valence has no warm/cool expectation)', () => {
    const cool: Color = '#2a4fd0'
    const inverted = defineMoodPalette(
      'neutral-probe',
      Object.fromEntries(MOODS.map((mood) => [mood, cool])) as Record<Mood, Color>,
    )

    const warnings = checkPaletteAxisConsistency(inverted)

    expect(warnings.some((warning) => warning.mood === 'NEUTRAL')).toBe(false)
  })
})
