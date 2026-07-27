import { beforeEach, describe, expect, it } from 'vitest'

import { useChargeRequestStore } from './charge-request-store.ts'
import { resetTwinkleUserState } from './index.ts'
import { twinkleTotal, useTwinkleBalanceStore } from './twinkle-balance-store.ts'

describe('twinkle balance mirror', () => {
  beforeEach(() => {
    resetTwinkleUserState()
  })

  it('derives total as small + general, never a stored field (A2)', () => {
    expect(twinkleTotal({ small: 100n, general: 40n })).toBe(140n)
    expect(twinkleTotal({ small: 0n, general: 0n })).toBe(0n)
    expect(twinkleTotal({ small: 100n, general: 0n })).toBe(100n)
  })

  it('mirrors the two kinds from a GetBalance read and marks loaded', () => {
    expect(useTwinkleBalanceStore.getState().loaded).toBe(false)
    useTwinkleBalanceStore.getState().setBalance(100n, 40n)
    const next = useTwinkleBalanceStore.getState()
    expect(next.small).toBe(100n)
    expect(next.general).toBe(40n)
    expect(next.loaded).toBe(true)
    expect(twinkleTotal(next)).toBe(140n)
  })

  it('clear resets to an unloaded zero balance (sign-out leaves no prior kinds)', () => {
    useTwinkleBalanceStore.getState().setBalance(5n, 5n)
    useTwinkleBalanceStore.getState().clear()
    const state = useTwinkleBalanceStore.getState()
    expect(state.small).toBe(0n)
    expect(state.general).toBe(0n)
    expect(state.loaded).toBe(false)
  })

  it('resets every Twinkle-owned user singleton together', () => {
    useTwinkleBalanceStore.getState().setBalance(5n, 5n)
    useChargeRequestStore.getState().request()

    resetTwinkleUserState()

    expect(useTwinkleBalanceStore.getState()).toMatchObject({ small: 0n, general: 0n })
    expect(useChargeRequestStore.getState().requested).toBe(false)
  })
})
