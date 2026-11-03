import { describe, expect, it } from 'vitest'
import {
  advanceStarAppearance,
  createStarAppearance,
  reconcileStarAppearance,
} from './star-appearance.ts'

describe('memory appearance', () => {
  it('settles a fetched history after a loading frame and animates a pending local birth', () => {
    const state = createStarAppearance()
    reconcileStarAppearance(state, [], [], new Float32Array(), false, new Set())
    const scales = new Float32Array(2)
    reconcileStarAppearance(state, ['history', 'local'], [2, 3], scales, false, new Set(['local']))
    expect([...scales]).toEqual([2, 0])
  })
  it('hydrates existing memories silently and reveals only a new birth', () => {
    const state = createStarAppearance()
    const initial = new Float32Array(1)
    reconcileStarAppearance(state, ['old'], [2], initial, false)
    expect([...initial]).toEqual([2])
    const scales = new Float32Array(2)
    reconcileStarAppearance(state, ['old', 'new'], [2, 3], scales, false)
    expect([...scales]).toEqual([2, 0])
    expect(advanceStarAppearance(state, 5, [2, 3], scales, true)).toBe(false)
    expect([...scales]).toEqual([2, 0])
    let previous = 0
    for (let frame = 0; frame < 40; frame++) {
      advanceStarAppearance(state, 0.05, [2, 3], scales)
      expect(scales[0]).toBe(2)
      expect(scales[1]).toBeGreaterThanOrEqual(previous)
      expect(scales[1]).toBeLessThanOrEqual(3)
      previous = scales[1]!
    }
    expect([...scales]).toEqual([2, 3])
    expect(advanceStarAppearance(state, 0.05, [2, 3], scales)).toBe(false)
  })

  it('does not replay a birth on a channel update and honors reduced motion mid-flight', () => {
    const state = createStarAppearance()
    reconcileStarAppearance(state, [], [], new Float32Array(), false)
    const scales = new Float32Array(1)
    reconcileStarAppearance(state, ['new'], [2], scales, false)
    advanceStarAppearance(state, 0.05, [2], scales)
    const progress = scales[0]
    reconcileStarAppearance(state, ['new'], [2], scales, false)
    expect(scales[0]).toBe(progress)
    reconcileStarAppearance(state, ['new'], [4], scales, true)
    expect([...scales]).toEqual([4])
    expect(advanceStarAppearance(state, 0.05, [4], scales)).toBe(false)
  })
})
