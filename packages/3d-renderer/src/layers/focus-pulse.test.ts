import { describe, expect, it } from 'vitest'
import { advanceFocusPulse, createFocusPulse } from './focus-pulse.ts'

describe('focus feedback', () => {
  it('expands and fades, emitting completion only once', () => {
    const pulse = createFocusPulse()
    let completed = 0
    for (let i = 0; i < 20; i++) completed += Number(advanceFocusPulse(pulse, 0.1, false))
    expect(completed).toBe(1)
    expect(pulse.scale).toBeCloseTo(2.8)
    expect(pulse.opacity).toBe(0)
  })
  it('keeps reduced-motion feedback static and shorter', () => {
    const pulse = createFocusPulse()
    advanceFocusPulse(pulse, 0.1, true)
    const scale = pulse.scale
    for (let i = 0; i < 3; i++) advanceFocusPulse(pulse, 0.1, true)
    expect(pulse.scale).toBe(scale)
    expect(pulse.completed).toBe(true)
    expect(pulse.elapsed).toBeLessThan(0.5)
  })
  it('bounds a delayed frame and ignores negative time', () => {
    const pulse = createFocusPulse()
    advanceFocusPulse(pulse, -1, false)
    expect(pulse.elapsed).toBe(0)
    advanceFocusPulse(pulse, 60, false)
    expect(pulse.completed).toBe(false)
    expect(pulse.elapsed).toBe(0.1)
  })
})
