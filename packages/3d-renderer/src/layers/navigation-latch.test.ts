import { describe, expect, it } from 'vitest'

import { createArrivalLatchState, stepArrivalLatch } from './navigation-latch.ts'

const TIMEOUT = 6
const DT = 0.016

describe('arrival latch', () => {
  it('fires ARRIVED once when a glide settles inside the shell, then holds', () => {
    const state = createArrivalLatchState()

    expect(
      stepArrivalLatch(state, {
        mode: 'flying',
        targetId: 'a',
        withinEpsilon: false,
        delta: DT,
        arriveTimeoutSeconds: TIMEOUT,
      }),
    ).toBe(false)
    expect(
      stepArrivalLatch(state, {
        mode: 'flying',
        targetId: 'a',
        withinEpsilon: true,
        delta: DT,
        arriveTimeoutSeconds: TIMEOUT,
      }),
    ).toBe(true)
    expect(
      stepArrivalLatch(state, {
        mode: 'flying',
        targetId: 'a',
        withinEpsilon: true,
        delta: DT,
        arriveTimeoutSeconds: TIMEOUT,
      }),
    ).toBe(false)
  })

  it('re-arms on leaving the shell (drift) and fires again on re-entry', () => {
    const state = createArrivalLatchState()

    stepArrivalLatch(state, {
      mode: 'focusing',
      targetId: 'a',
      withinEpsilon: true,
      delta: DT,
      arriveTimeoutSeconds: TIMEOUT,
    })
    stepArrivalLatch(state, {
      mode: 'focusing',
      targetId: 'a',
      withinEpsilon: false,
      delta: DT,
      arriveTimeoutSeconds: TIMEOUT,
    })
    expect(
      stepArrivalLatch(state, {
        mode: 'focusing',
        targetId: 'a',
        withinEpsilon: true,
        delta: DT,
        arriveTimeoutSeconds: TIMEOUT,
      }),
    ).toBe(true)
  })

  it('fires for a same-mode retarget landing inside the shell after an unobserved idle (regression: epsilon-band stranding)', () => {
    const state = createArrivalLatchState()

    // Focus A, arrive. The machine would flip to idle here, but the rig never polls that idle
    // frame — the user clicks node B before the next frame.
    stepArrivalLatch(state, {
      mode: 'focusing',
      targetId: 'a',
      withinEpsilon: true,
      delta: DT,
      arriveTimeoutSeconds: TIMEOUT,
    })

    // Next observed frame: mode is STILL 'focusing', but now targeting B, which sits within the
    // arrival shell. This must fire ARRIVED for B — otherwise the glide strands forever.
    const fired = stepArrivalLatch(state, {
      mode: 'focusing',
      targetId: 'b',
      withinEpsilon: true,
      delta: DT,
      arriveTimeoutSeconds: TIMEOUT,
    })
    expect(fired).toBe(true)
  })

  it('force-arrives when a drifting target never settles within the timeout (safety net)', () => {
    const state = createArrivalLatchState()
    let firedEarly = false

    for (let t = 0; t < TIMEOUT - 0.5; t += 0.1) {
      firedEarly ||= stepArrivalLatch(state, {
        mode: 'flying',
        targetId: 'a',
        withinEpsilon: false,
        delta: 0.1,
        arriveTimeoutSeconds: TIMEOUT,
      })
    }
    expect(firedEarly).toBe(false)

    let firedLate = false
    for (let t = TIMEOUT - 0.5; t < TIMEOUT + 0.5; t += 0.1) {
      firedLate ||= stepArrivalLatch(state, {
        mode: 'flying',
        targetId: 'a',
        withinEpsilon: false,
        delta: 0.1,
        arriveTimeoutSeconds: TIMEOUT,
      })
    }
    expect(firedLate).toBe(true)
  })

  it('resets when the machine returns to idle', () => {
    const state = createArrivalLatchState()

    stepArrivalLatch(state, {
      mode: 'flying',
      targetId: 'a',
      withinEpsilon: true,
      delta: DT,
      arriveTimeoutSeconds: TIMEOUT,
    })
    stepArrivalLatch(state, {
      mode: 'idle',
      targetId: null,
      withinEpsilon: false,
      delta: DT,
      arriveTimeoutSeconds: TIMEOUT,
    })

    expect(state.arrivedSent).toBe(false)
    expect(state.glideElapsed).toBe(0)
  })
})
