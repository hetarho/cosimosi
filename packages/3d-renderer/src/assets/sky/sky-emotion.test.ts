import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'

import { buildEmotionGradientTexture, emotionRampCenters } from './emotion-gradient.ts'
import { emotionAnchors, emotionField, emotionRadius } from './sky-emotion.ts'

// The emotion partition is the axis every sky recipe divides its structure by, so its contract is
// checked as arithmetic rather than by eye: territories that sum to the whole sphere, anchors that are
// a lattice rather than a ring, and a graph that actually builds (a TSL graph that throws shows up as
// a blank canvas, never as an error).

const MOODS = 13

function stops(weights: readonly number[]) {
  return weights.map((weight) => ({ color: '#ff8800', weight }))
}

describe('emotion anchors', () => {
  it('places one feeling at the view centre, so a single-emotion sky opens facing its colour', () => {
    expect(emotionAnchors(1)).toEqual([[0, 0, -1]])
  })

  it('returns unit directions at every count up to the full mood set', () => {
    for (let count = 1; count <= MOODS; count++) {
      for (const [x, y, z] of emotionAnchors(count)) {
        expect(Math.hypot(x, y, z), `count ${count}`).toBeCloseTo(1, 6)
      }
    }
  })

  it('spreads over the sphere rather than around a circle', () => {
    // A ring arrangement would hold one coordinate almost constant. The lattice must not.
    const ys = emotionAnchors(MOODS).map(([, y]) => y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1.5)
  })

  it('keeps every pair apart, so no two feelings share a seat', () => {
    const anchors = emotionAnchors(MOODS)
    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        const dot =
          anchors[i][0] * anchors[j][0] +
          anchors[i][1] * anchors[j][1] +
          anchors[i][2] * anchors[j][2]
        expect(dot, `${i}/${j}`).toBeLessThan(0.95)
      }
    }
  })
})

describe('emotion territory', () => {
  it('gives a feeling exactly its share of the sphere', () => {
    // A cap of angular radius r covers (1 − cos r) / 2 of the sphere.
    for (const weight of [0.05, 0.2, 0.5, 0.8, 1]) {
      const area = (1 - Math.cos(emotionRadius(weight))) / 2
      expect(area, String(weight)).toBeCloseTo(weight, 10)
    }
  })

  it('covers the whole sphere once across a normalized weight set', () => {
    const weights = [0.4, 0.3, 0.2, 0.1]
    const covered = weights
      .map((w) => (1 - Math.cos(emotionRadius(w))) / 2)
      .reduce((sum, area) => sum + area, 0)
    expect(covered).toBeCloseTo(1, 10)
  })

  it('hands a single feeling the entire sphere', () => {
    expect(emotionRadius(1)).toBeCloseTo(Math.PI, 10)
  })
})

describe('emotion ramp layout', () => {
  it('centres each band on the running midpoint of its share', () => {
    expect(emotionRampCenters(stops([0.5, 0.3, 0.2]))).toEqual([0.25, 0.65, 0.9])
  })

  it('carries every emotion at full depth — a faint feeling is narrow, not washed out', () => {
    // One dominant feeling and one almost absent: both bands must reach the same colour, because
    // weight buys area and never depth.
    const texture = buildEmotionGradientTexture([
      { color: '#ff0000', weight: 0.97 },
      { color: '#ff0000', weight: 0.03 },
    ])
    const data = texture.image.data as Uint8Array
    const at = (t: number) => {
      const x = Math.min(255, Math.max(0, Math.round(t * 256 - 0.5)))
      return data[x * 4]
    }
    const centers = emotionRampCenters([
      { color: '#ff0000', weight: 0.97 },
      { color: '#ff0000', weight: 0.03 },
    ])
    expect(at(centers[1])).toBe(at(centers[0]))
    texture.dispose()
  })
})

describe('emotion field graph', () => {
  it('builds a colour graph at every count, and shares that resolve', () => {
    const texture = buildEmotionGradientTexture(stops([0.4, 0.3, 0.2, 0.1]))
    for (const count of [1, 2, 5, MOODS]) {
      const weights = Array.from({ length: count }, (_, i) => count - i)
      const field = emotionField({ gradient: texture, count, weights })
      expect(field.anchors, `count ${count}`).toHaveLength(count)
      expect(field.color).toBeDefined()
      expect(field.presence).toBeDefined()
      expect(field.shareOf(0)).toBeDefined()
      expect(field.colorOf(count - 1)).toBeDefined()
      // Normalized shares, primary-first and summing to one.
      expect(field.weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1, 10)
      expect(field.weights[0]).toBeGreaterThanOrEqual(field.weights[count - 1])
    }
    texture.dispose()
  })

  it('mounts the blended colour on a material without throwing', () => {
    const texture = buildEmotionGradientTexture(stops([0.6, 0.4]))
    const field = emotionField({ gradient: texture, count: 2, weights: [0.6, 0.4] })
    const material = new THREE.MeshBasicNodeMaterial()
    material.colorNode = field.color as never
    expect(material.colorNode).toBeDefined()
    material.dispose()
    texture.dispose()
  })

  it('clamps an out-of-range emotion index instead of yielding nothing', () => {
    const texture = buildEmotionGradientTexture(stops([1]))
    const field = emotionField({ gradient: texture, count: 1, weights: [1] })
    expect(field.colorOf(-5)).toBeDefined()
    expect(field.shareOf(99)).toBeDefined()
    texture.dispose()
  })
})
