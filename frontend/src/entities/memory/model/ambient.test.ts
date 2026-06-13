import { describe, expect, it } from 'vitest'
import {
  AMBIENT_LIGHTS_K,
  ambientLights,
  ambientToRgb,
  deriveAmbient,
  excitabilityGain,
  type AmbientStar,
} from './ambient'

const DAY_MS = 86_400_000
const NOW = 1_700_000_000_000

/** A star last active `daysAgo` before NOW. */
function star(mood: string, intensity: number, valence: number, daysAgo: number): AmbientStar {
  return { mood, intensity, valence, lastRecalledAt: NOW - daysAgo * DAY_MS }
}

describe('deriveAmbient', () => {
  it('empty / zero-weight input is neutral (1.4)', () => {
    expect(deriveAmbient([], NOW)).toEqual({ hue: 0, sat: 0, arousal: 0, valence: 0 })
    // zero intensity contributes no weight → still neutral
    expect(deriveAmbient([star('joy', 0, 0.8, 0)], NOW)).toEqual({
      hue: 0,
      sat: 0,
      arousal: 0,
      valence: 0,
    })
  })

  it('decays monotonically as the same event recedes (1.3)', () => {
    let prev = Infinity
    for (const daysAgo of [0, 1, 3, 7, 14]) {
      const a = deriveAmbient([star('joy', 0.8, 0.6, daysAgo)], NOW)
      expect(a.arousal).toBeLessThan(prev)
      prev = a.arousal
    }
    // beyond ~3·τ the contribution is negligible
    expect(deriveAmbient([star('joy', 0.8, 0.6, 21)], NOW).arousal).toBeLessThan(0.05)
  })

  it('turbulent recent self reads higher arousal + negative valence than a calm one (1.2)', () => {
    const turbulent = deriveAmbient(
      [star('anger', 0.85, -0.7, 1), star('fear', 0.8, -0.6, 2), star('anger', 0.9, -0.65, 0)],
      NOW,
    )
    const calm = deriveAmbient(
      [star('calm', 0.3, 0.5, 1), star('calm', 0.25, 0.45, 2), star('calm', 0.35, 0.55, 0)],
      NOW,
    )
    expect(turbulent.arousal).toBeGreaterThan(calm.arousal)
    expect(turbulent.valence).toBeLessThan(0)
    expect(calm.valence).toBeGreaterThan(0)
    expect(turbulent.hue).not.toBeCloseTo(calm.hue)
  })

  it('valence is the time-weighted mean (recent strong dominates)', () => {
    const a = deriveAmbient([star('joy', 0.9, 0.8, 0), star('sad', 0.2, -0.6, 6)], NOW)
    expect(a.valence).toBeGreaterThan(0)
    expect(a.valence).toBeLessThanOrEqual(0.8)
  })
})

describe('ambientToRgb', () => {
  it('returns in-range RGB and preserves mood meaning (theme-independent, 1.8)', () => {
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

describe('ambientLights', () => {
  it('empty universe yields no lights (1.2b)', () => {
    expect(ambientLights([], NOW)).toEqual([])
    expect(ambientLights([star('joy', 0, 0, 0)], NOW)).toEqual([])
  })

  it('a single dominant mood collapses to one pool (1.2b)', () => {
    const lights = ambientLights(
      [star('calm', 0.5, 0.4, 0), star('calm', 0.6, 0.45, 1), star('calm', 0.55, 0.5, 2)],
      NOW,
    )
    expect(lights).toHaveLength(1)
    expect(lights[0].mood).toBe('calm')
    expect(lights[0].weight).toBeCloseTo(1, 5)
  })

  it('returns the top-K dominant moods by weighted share, descending', () => {
    const stars: AmbientStar[] = [
      star('joy', 0.9, 0.7, 0),
      star('joy', 0.8, 0.6, 0),
      star('anger', 0.85, -0.6, 0),
      star('calm', 0.5, 0.4, 0),
      star('sad', 0.4, -0.4, 0),
      star('love', 0.6, 0.7, 0),
      star('fear', 0.5, -0.5, 0),
      star('relief', 0.45, 0.4, 0),
    ]
    const lights = ambientLights(stars, NOW)
    expect(lights.length).toBeLessThanOrEqual(AMBIENT_LIGHTS_K)
    // joy is doubled → it must be the brightest pool, and weights are sorted desc.
    expect(lights[0].mood).toBe('joy')
    for (let i = 1; i < lights.length; i++) {
      expect(lights[i - 1].weight).toBeGreaterThanOrEqual(lights[i].weight)
    }
  })
})

describe('excitabilityGain', () => {
  it('maps arousal∈[0,1] onto [1,1.3] (1.5)', () => {
    expect(excitabilityGain({ hue: 0, sat: 0, arousal: 0, valence: 0 })).toBe(1)
    expect(excitabilityGain({ hue: 0, sat: 0, arousal: 1, valence: 0 })).toBeCloseTo(1.3, 9)
    expect(excitabilityGain({ hue: 0, sat: 0, arousal: 0.5, valence: 0 })).toBeCloseTo(1.15, 9)
  })
})
