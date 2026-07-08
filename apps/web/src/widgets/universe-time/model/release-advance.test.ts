import { beforeEach, describe, expect, it } from 'vitest'

import { useUniverseClockStore } from '@cosimosi/universe'

import { useLaunchedNeuronsStore } from '../../../features/launch-stars/index.ts'
import { releaseAdvance } from './release-advance.ts'

// The reveal half of [T2] case 1 (accelerate → then the launched memory appears): the overlay
// calls this when the transition completes — or, idempotently, on an interrupted sweep — so the
// awaken announce and the clock landing are what "after the acceleration" means in code.
describe('releaseAdvance', () => {
  beforeEach(() => {
    useUniverseClockStore.getState().clear()
    useLaunchedNeuronsStore.getState().announce([])
  })

  it('announces the deferred awaken ids and lands the clock on the interval end', () => {
    releaseAdvance({
      interval: { previous: '2026-07-01', current: '2026-07-08' },
      revealNeuronIds: ['n1', 'n2'],
    })
    expect(useLaunchedNeuronsStore.getState().newNeuronIds).toEqual(['n1', 'n2'])
    expect(useUniverseClockStore.getState().currentUniverseTime).toBe('2026-07-08')
  })

  it('never rewinds the clock ([I10]): a stale release below a newer value is ignored', () => {
    useUniverseClockStore.getState().setCurrent('2026-07-15')
    releaseAdvance({ interval: { previous: '2026-07-01', current: '2026-07-10' }, revealNeuronIds: [] })
    expect(useUniverseClockStore.getState().currentUniverseTime).toBe('2026-07-15')
  })

  it('unions reveal ids with the current set — a release cannot clobber a pending same-day announce', () => {
    useLaunchedNeuronsStore.getState().announce(['a'])
    releaseAdvance({ interval: { previous: '2026-07-01', current: '2026-07-08' }, revealNeuronIds: ['b'] })
    expect([...useLaunchedNeuronsStore.getState().newNeuronIds].sort()).toEqual(['a', 'b'])
  })

  it('leaves the awaken store untouched when there is nothing to reveal', () => {
    useLaunchedNeuronsStore.getState().announce(['keep'])
    releaseAdvance({ interval: { previous: '2026-07-01', current: '2026-07-08' }, revealNeuronIds: [] })
    expect(useLaunchedNeuronsStore.getState().newNeuronIds).toEqual(['keep'])
  })
})
