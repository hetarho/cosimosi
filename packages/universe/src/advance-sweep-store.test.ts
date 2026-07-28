import { beforeEach, describe, expect, it } from 'vitest'

import { advanceSweepFrame, type AdvanceInterval } from './advance-interval.ts'
import {
  ADVANCE_SKY_PEAK_RATE,
  advanceSkyRate,
  advanceSkyRateFor,
  resetAdvanceSkyRate,
  useAdvanceSweepStore,
} from './advance-sweep-store.ts'

// The sweep → scene seam. What matters is that the scene never sees a clock that would make a star
// jump: the sampled clock starts where the viewer last saw it, ends absent so the committed read
// clock resumes, and the sky's rate returns to rest no matter how a sweep ends.

beforeEach(() => {
  useAdvanceSweepStore.getState().reset()
  resetAdvanceSkyRate()
})

describe('the scene clock during a sweep', () => {
  it('is absent at rest, so the committed read clock governs', () => {
    expect(useAdvanceSweepStore.getState().sampledTime).toBeNull()
  })

  it('opens on the clock the viewer last saw, never on the new one', () => {
    // Opening on `current` would brighten every star for one frame before dimming it back down.
    useAdvanceSweepStore.getState().begin('2026-01-01')
    expect(useAdvanceSweepStore.getState().sampledTime).toBe('2026-01-01')
  })

  it('walks forward as the sweep samples dates', () => {
    const store = useAdvanceSweepStore.getState()
    store.begin('2026-01-01')
    store.tick('2026-01-20')
    expect(useAdvanceSweepStore.getState().sampledTime).toBe('2026-01-20')
  })

  it('releases the scene back to the read clock when the sweep ends', () => {
    const store = useAdvanceSweepStore.getState()
    store.begin('2026-01-01')
    store.tick('2026-02-01')
    store.end()
    expect(useAdvanceSweepStore.getState().sampledTime).toBeNull()
  })

  it('carries a null previous through — the first-ever launch has no prior clock', () => {
    useAdvanceSweepStore.getState().begin(null)
    expect(useAdvanceSweepStore.getState().sampledTime).toBeNull()
  })
})

describe('the sky rate', () => {
  it('rests at one, so nothing flows when no time is passing', () => {
    expect(advanceSkyRate.current).toBe(1)
    expect(advanceSkyRateFor(0)).toBe(1)
  })

  it('reaches its peak at the top of the sweep envelope', () => {
    expect(advanceSkyRateFor(1)).toBe(ADVANCE_SKY_PEAK_RATE)
  })

  it('rises monotonically with the envelope, so the flow eases rather than snapping', () => {
    const rates = [0, 0.25, 0.5, 0.75, 1].map(advanceSkyRateFor)
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThan(rates[i - 1])
    }
  })

  it('never rewinds or stalls the sky on a malformed envelope', () => {
    // A negative or over-unit input must not produce a rate below 1 (the sky would slow or reverse).
    expect(advanceSkyRateFor(-3)).toBe(1)
    expect(advanceSkyRateFor(9)).toBe(ADVANCE_SKY_PEAK_RATE)
  })

  it('returns to rest when a sweep is abandoned mid-flight', () => {
    advanceSkyRate.current = advanceSkyRateFor(1)
    resetAdvanceSkyRate()
    expect(advanceSkyRate.current).toBe(1)
  })

  it('tracks the shared frame envelope across a whole sweep, ending back at rest', () => {
    const interval: AdvanceInterval = { previous: '2026-01-01', current: '2026-03-01' }
    const first = advanceSkyRateFor(advanceSweepFrame(interval, 0).envelope)
    const done = advanceSweepFrame(interval, 60_000)
    expect(first).toBeCloseTo(1)
    expect(done.done).toBe(true)
    expect(advanceSkyRateFor(done.envelope)).toBeCloseTo(1)
  })
})
