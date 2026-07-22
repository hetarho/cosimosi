import { describe, expect, it } from 'vitest'
import { uniform } from 'three/tsl'

import { buildEmotionGradientTexture } from '../assets/sky/emotion-gradient.ts'
import { SKY_EFFECTS } from '../assets/sky/sky-effects.ts'
import { createSkyMaterial } from './SkySphere.tsx'

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
    })

    expect(material.transparent).toBe(false)

    material.dispose()
    gradient.dispose()
  })
})
