import { beforeEach, describe, expect, it } from 'vitest'

import { useChargeRequestStore } from './charge-request-store.ts'
import { resetTwinkleUserState } from './index.ts'
import { twinkleTotal, useTwinkleBalanceStore } from './twinkle-balance-store.ts'

describe('twinkle balance mirror', () => {
  beforeEach(() => {
    resetTwinkleUserState()
  })

  it('derives total as basic + additional, never a stored field (A2)', () => {
    expect(twinkleTotal({ basic: 100n, additional: 40n })).toBe(140n)
    expect(twinkleTotal({ basic: 0n, additional: 0n })).toBe(0n)
    expect(twinkleTotal({ basic: 100n, additional: 0n })).toBe(100n)
  })

  it('mirrors the two tiers from a GetBalance read and marks loaded', () => {
    expect(useTwinkleBalanceStore.getState().loaded).toBe(false)
    useTwinkleBalanceStore.getState().setBalance(100n, 40n)
    const next = useTwinkleBalanceStore.getState()
    expect(next.basic).toBe(100n)
    expect(next.additional).toBe(40n)
    expect(next.loaded).toBe(true)
    expect(twinkleTotal(next)).toBe(140n)
  })

  it('clear resets to an unloaded zero balance (sign-out leaves no prior tiers)', () => {
    useTwinkleBalanceStore.getState().setBalance(5n, 5n)
    useTwinkleBalanceStore.getState().clear()
    const state = useTwinkleBalanceStore.getState()
    expect(state.basic).toBe(0n)
    expect(state.additional).toBe(0n)
    expect(state.loaded).toBe(false)
  })

  it('resets every Twinkle-owned user singleton together', () => {
    useTwinkleBalanceStore.getState().setBalance(5n, 5n)
    useChargeRequestStore.getState().request()

    resetTwinkleUserState()

    expect(useTwinkleBalanceStore.getState()).toMatchObject({ basic: 0n, additional: 0n })
    expect(useChargeRequestStore.getState().requested).toBe(false)
  })
})
