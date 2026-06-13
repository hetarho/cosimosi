import { describe, expect, it } from 'vitest'
import {
  A_MIN,
  ALPHA_MIN,
  alpha,
  bucketWidthPx,
  emissive,
  pulseAmp,
  visualIntensity,
  WIDTH_THICK_PX,
  WIDTH_THIN_PX,
  widthBucket,
} from './mapping'
import type { LinkType, SynapseEdge } from './types'

function edge(weight: number, brightness: number, recency = 0, linkType: LinkType = 'semantic'): SynapseEdge {
  return { aId: 'a', bId: 'b', weight, brightness, reinforcedRecency: recency, coActivationCount: 0, linkType }
}

describe('synapse mapping', () => {
  it('visualIntensity = weight · max(a_min, brightness) (1.4 floor)', () => {
    expect(visualIntensity(edge(1, 1))).toBe(1)
    expect(visualIntensity(edge(0, 1))).toBe(0)
    expect(visualIntensity(edge(0.5, 0.5))).toBeCloseTo(0.25, 10)
    // brightness below a_min is floored at a_min
    expect(visualIntensity(edge(1, 0.01))).toBeCloseTo(A_MIN, 10)
  })

  it('emissive equals visualIntensity (1.2)', () => {
    expect(emissive(edge(1, 1))).toBe(1)
    expect(emissive(edge(0, 1))).toBe(0)
  })

  it('alpha floors weak/dormant edges at ALPHA_MIN, tops at 1 (1.2/1.4)', () => {
    expect(alpha(edge(0, 0))).toBeCloseTo(ALPHA_MIN, 10) // intensity 0 → floor
    expect(alpha(edge(1, 1))).toBeCloseTo(1, 10) // intensity 1 → max
    expect(alpha(edge(0.5, 1))).toBeCloseTo(ALPHA_MIN + (1 - ALPHA_MIN) * 0.5, 10)
    expect(alpha(edge(0, 0))).toBeGreaterThan(0) // never fully invisible
  })

  it('pulseAmp is reinforcedRecency (1.3)', () => {
    expect(pulseAmp(edge(1, 1, 0))).toBe(0) // no pulse
    expect(pulseAmp(edge(1, 1, 0.7))).toBe(0.7)
  })

  it('widthBucket splits at THICK_THRESHOLD (0.5)', () => {
    expect(widthBucket(edge(0.49, 1))).toBe('thin')
    expect(widthBucket(edge(0.5, 1))).toBe('thick')
    expect(bucketWidthPx('thin')).toBe(WIDTH_THIN_PX)
    expect(bucketWidthPx('thick')).toBe(WIDTH_THICK_PX)
  })
})
