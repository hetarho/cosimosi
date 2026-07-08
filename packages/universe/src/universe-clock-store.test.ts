import { beforeEach, describe, expect, it } from 'vitest'

import { useUniverseClockStore } from './universe-clock-store.ts'

describe('universe clock store', () => {
  beforeEach(() => {
    useUniverseClockStore.getState().clear()
  })

  it('starts unborn (null) and mirrors the synced value', () => {
    expect(useUniverseClockStore.getState().currentUniverseTime).toBeNull()
    useUniverseClockStore.getState().setCurrent('2026-07-08')
    expect(useUniverseClockStore.getState().currentUniverseTime).toBe('2026-07-08')
  })

  it('clears back to the empty-universe state', () => {
    useUniverseClockStore.getState().setCurrent('2026-07-08')
    useUniverseClockStore.getState().clear()
    expect(useUniverseClockStore.getState().currentUniverseTime).toBeNull()
  })
})
