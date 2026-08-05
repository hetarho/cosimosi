import { describe, expect, it } from 'vitest'
import { uniform } from 'three/tsl'

import { buildEmotionGradientTexture } from '../assets/sky/emotion-gradient.ts'
import { SKY_EFFECTS } from '../assets/sky/sky-effects.ts'
import { createSkyMaterial, normalizeSkyWeights, skyWeightsKey } from './SkySphere.tsx'

describe('emotion sky material', () => {
  it('gives every registered backdrop a partial-opacity tuning', () => {
    for (const effect of SKY_EFFECTS) {
      expect(effect.opacity, effect.key).toBeGreaterThan(0)
      expect(effect.opacity, effect.key).toBeLessThan(1)
    }
  })

  it('uses normal transparency as a depth-tested, non-writing backdrop', () => {
    const gradient = buildEmotionGradientTexture([{ color: '#ff0000', weight: 1 }])
    const material = createSkyMaterial({
      gradient,
      time: uniform(0),
      effect: 'grainient',
      count: 1,
      weights: [1],
      opacity: 0.82,
      headroom: 0.7,
    })

    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.depthTest).toBe(true)
    expect(material.opacityNode).toBeDefined()

    material.dispose()
    gradient.dispose()
  })

  it('clamps opacity to an opaque material at one', () => {
    const gradient = buildEmotionGradientTexture([{ color: '#ff0000', weight: 1 }])
    const material = createSkyMaterial({
      gradient,
      time: uniform(0),
      effect: 'grainient',
      count: 1,
      weights: [1],
      opacity: 2,
      headroom: 0.7,
    })

    expect(material.transparent).toBe(false)

    material.dispose()
    gradient.dispose()
  })
})

describe('sky material memo key (R003)', () => {
  const stops = () => [
    { color: '#ff0000', weight: 2 },
    { color: '#00ff00', weight: 1 },
    { color: '#0000ff', weight: 1 },
  ]

  it('is identical for two distinct arrays carrying the same emotions', () => {
    // What a content-identical GetUniverse refetch produces: a fresh array, the same numbers. The
    // material must not rebuild — recompiling the sky's TSL shader is the scene's costliest work.
    const first = stops()
    const second = stops()
    expect(second).not.toBe(first)
    expect(skyWeightsKey(normalizeSkyWeights(second))).toBe(
      skyWeightsKey(normalizeSkyWeights(first)),
    )
  })

  it('moves when a weight value moves', () => {
    const changed = stops()
    changed[1] = { color: '#00ff00', weight: 3 }
    expect(skyWeightsKey(normalizeSkyWeights(changed))).not.toBe(
      skyWeightsKey(normalizeSkyWeights(stops())),
    )
  })

  it('moves when the emotion count changes, since count-structured effects bake it in', () => {
    expect(skyWeightsKey(normalizeSkyWeights(stops().slice(0, 2)))).not.toBe(
      skyWeightsKey(normalizeSkyWeights(stops())),
    )
  })

  it('ignores a color-only change — that takes the ramp-repaint path instead', () => {
    const recolored = stops().map((stop, index) =>
      index === 0 ? { color: '#123456', weight: stop.weight } : stop,
    )
    expect(skyWeightsKey(normalizeSkyWeights(recolored))).toBe(
      skyWeightsKey(normalizeSkyWeights(stops())),
    )
  })

  it('round-trips through the key, so the derived array is the fixed-precision one', () => {
    // The component rebuilds `weights` from this string, which is what makes the memo's dependency
    // list honest: the array's identity moves exactly when a weight's six-decimal value moves.
    const weights = normalizeSkyWeights(stops())
    expect(skyWeightsKey(weights).split(',').map(Number)).toEqual(
      weights.map((weight) => Number(weight.toFixed(6))),
    )
  })

  it('spreads evenly rather than dividing by zero when nothing carries weight', () => {
    expect(
      normalizeSkyWeights([
        { color: '#fff', weight: 0 },
        { color: '#000', weight: 0 },
      ]),
    ).toEqual([0.5, 0.5])
  })
})
