import { describe, expect, it } from 'vitest'
import {
  centroid,
  distance,
  isDoubleTap,
  passedDeadzone,
  spread,
  thrustRamp,
  zoomScrubDelta,
} from './navigation-gesture'

describe('passedDeadzone', () => {
  it('is false inside the deadzone, true once travel reaches it', () => {
    const o = { x: 100, y: 100 }
    expect(passedDeadzone(o, { x: 104, y: 100 }, 8)).toBe(false)
    expect(passedDeadzone(o, { x: 108, y: 100 }, 8)).toBe(true)
    expect(passedDeadzone(o, { x: 100, y: 113 }, 8)).toBe(true)
  })
})

describe('centroid / spread', () => {
  it('centroid averages the points', () => {
    expect(centroid([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toEqual({ x: 5, y: 10 })
  })
  it('spread is the two-pointer distance, 0 for fewer than two', () => {
    expect(spread([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBeCloseTo(5)
    expect(spread([{ x: 0, y: 0 }])).toBe(0)
    expect(spread([])).toBe(0)
  })
  it('distance is symmetric', () => {
    expect(distance({ x: 1, y: 1 }, { x: 4, y: 5 })).toBeCloseTo(5)
  })
})

describe('isDoubleTap', () => {
  it('requires a prior tap within the time and distance windows', () => {
    expect(isDoubleTap(null, { t: 100, pt: { x: 0, y: 0 } }, 300, 24)).toBe(false)
    const prev = { t: 0, pt: { x: 10, y: 10 } }
    expect(isDoubleTap(prev, { t: 200, pt: { x: 12, y: 14 } }, 300, 24)).toBe(true)
    expect(isDoubleTap(prev, { t: 500, pt: { x: 12, y: 14 } }, 300, 24)).toBe(false) // too slow
    expect(isDoubleTap(prev, { t: 200, pt: { x: 60, y: 60 } }, 300, 24)).toBe(false) // too far
  })
})

describe('thrustRamp', () => {
  it('is 0 inside the deadzone', () => {
    expect(thrustRamp(4, 6, 90)).toBe(0)
    expect(thrustRamp(-5, 6, 90)).toBe(0)
  })
  it('up (negative dy) is forward (+), down is backward (−), ramping to ±1 at fullPx', () => {
    expect(thrustRamp(-90, 6, 90)).toBeCloseTo(1, 5)
    expect(thrustRamp(90, 6, 90)).toBeCloseTo(-1, 5)
    expect(thrustRamp(-200, 6, 90)).toBe(1) // clamped
    const mid = thrustRamp(-48, 6, 90) // halfway past the deadzone
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })
})

describe('zoomScrubDelta', () => {
  it('is 0 inside the deadzone', () => {
    expect(zoomScrubDelta(7, 8, 0.004)).toBe(0)
  })
  it('up (negative dy) shrinks radius (zoom in), down grows it (zoom out)', () => {
    expect(zoomScrubDelta(-40, 8, 0.004)).toBeLessThan(0)
    expect(zoomScrubDelta(40, 8, 0.004)).toBeGreaterThan(0)
  })
  it('only the travel past the deadzone scales (starts from rest)', () => {
    expect(zoomScrubDelta(-8.0001, 8, 0.004)).toBeCloseTo(-0.0001 * 0.004, 9)
  })
})
