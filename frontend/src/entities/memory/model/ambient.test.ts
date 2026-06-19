import { describe, expect, it } from 'vitest'
import {
  ambientToRgb,
  arousalOf,
  deriveAmbient,
  excitabilityGain,
  rankedEmotions,
  type AmbientStar,
} from './ambient'

const DAY_MS = 86_400_000
const NOW = 1_700_000_000_000

/** A star last active `daysAgo` before NOW, recalled `recallCount` times (spec 07). */
function star(
  mood: string,
  intensity: number,
  valence: number,
  daysAgo: number,
  recallCount = 1,
): AmbientStar {
  return { mood, intensity, valence, lastRecalledAt: NOW - daysAgo * DAY_MS, recallCount }
}

describe('deriveAmbient (self body color, R-weighted — spec 07)', () => {
  it('empty input is neutral', () => {
    expect(deriveAmbient([], NOW)).toEqual({ hue: 0, sat: 0, arousal: 0, valence: 0 })
  })

  it('arousal decays monotonically as the same event recedes (R falls with Δt)', () => {
    let prev = Infinity
    for (const daysAgo of [0, 1, 3, 7, 14, 30, 60]) {
      const a = deriveAmbient([star('joy', 0.8, 0.6, daysAgo)], NOW)
      expect(a.arousal).toBeLessThan(prev)
      prev = a.arousal
    }
  })

  it('turbulent recent self reads higher arousal + negative valence than a calm one', () => {
    const turbulent = deriveAmbient(
      [star('anger', 0.85, -0.7, 1), star('fear', 0.8, -0.6, 2), star('anger', 0.9, -0.65, 0)],
      NOW,
    )
    const calm = deriveAmbient([star('calm', 0.3, 0.5, 40), star('calm', 0.25, 0.45, 50)], NOW)
    expect(turbulent.arousal).toBeGreaterThan(calm.arousal)
    expect(turbulent.valence).toBeLessThan(0)
    expect(calm.valence).toBeGreaterThan(0)
  })
})

describe('ambientToRgb', () => {
  it('returns in-range RGB and preserves mood meaning (theme-independent)', () => {
    const joyish = ambientToRgb(deriveAmbient([star('joy', 0.8, 0.6, 0)], NOW))
    const calmish = ambientToRgb(deriveAmbient([star('calm', 0.8, 0.4, 0)], NOW))
    for (const c of [...joyish, ...calmish]) {
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThanOrEqual(1)
    }
    // joy = warm (red ≥ blue); calm = cool (blue ≥ red) — color carries meaning, not theme.
    expect(joyish[0]).toBeGreaterThan(joyish[2])
    expect(calmish[2]).toBeGreaterThan(calmish[0])
  })
})

describe('rankedEmotions (background weave — spec 07)', () => {
  it('empty universe yields no ranked emotions', () => {
    expect(rankedEmotions([], undefined, NOW)).toEqual([])
  })

  it('ranks moods by Σ R descending and the weights sum to ~1', () => {
    const stars = [star('joy', 0.9, 0.7, 0), star('joy', 0.8, 0.6, 0), star('anger', 0.85, -0.6, 0)]
    const ranked = rankedEmotions(stars, undefined, NOW)
    expect(ranked[0].mood).toBe('joy') // joy doubled → dominant
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].weight).toBeGreaterThanOrEqual(ranked[i].weight)
    }
    expect(ranked.reduce((s, e) => s + e.weight, 0)).toBeCloseTo(1, 5)
  })

  it('weaves the injected USER emotion color when provided (spec 45)', () => {
    const ranked = rankedEmotions([star('joy', 0.8, 0.6, 0)], { joy: '#ff0000' }, NOW)
    expect(ranked[0].rgb[0]).toBeCloseTo(1, 2)
    expect(ranked[0].rgb[1]).toBeCloseTo(0, 2)
    expect(ranked[0].rgb[2]).toBeCloseTo(0, 2)
  })

  it('an often-recalled mood outranks a once-recalled one at the same recency (S→τ)', () => {
    const ranked = rankedEmotions(
      [star('joy', 0.5, 0.5, 20, 1), star('calm', 0.5, 0.5, 20, 30)],
      undefined,
      NOW,
    )
    expect(ranked[0].mood).toBe('calm') // higher recall_count → higher R at the same Δt
  })
})

describe('arousalOf (background liveliness — spec 07)', () => {
  it('is ~0 for an empty universe and rises with more/stronger recent stars', () => {
    expect(arousalOf([], NOW)).toBeCloseTo(0)
    const few = arousalOf([star('joy', 0.5, 0.5, 0)], NOW)
    const many = arousalOf(
      [star('joy', 0.8, 0.5, 0), star('joy', 0.8, 0.5, 0), star('anger', 0.9, -0.5, 0)],
      NOW,
    )
    expect(many).toBeGreaterThan(few)
  })

  it('a long-dormant universe reads low arousal', () => {
    expect(arousalOf([star('joy', 0.5, 0.5, 400)], NOW)).toBeLessThan(0.2)
  })
})

describe('excitabilityGain', () => {
  it('maps arousal∈[0,1] onto [1,1.3]', () => {
    expect(excitabilityGain({ hue: 0, sat: 0, arousal: 0, valence: 0 })).toBe(1)
    expect(excitabilityGain({ hue: 0, sat: 0, arousal: 1, valence: 0 })).toBeCloseTo(1.3, 9)
    expect(excitabilityGain({ hue: 0, sat: 0, arousal: 0.5, valence: 0 })).toBeCloseTo(1.15, 9)
  })
})
