import { afterEach, describe, expect, it } from 'vitest'

import { reportSequenceSignal, useOnboardingSignalStore } from './signal-channel.ts'
import { takeOnboardingStart } from './start.ts'
import { resetOnboardingUserState } from './user-state-reset.ts'

const pending = () => useOnboardingSignalStore.getState().pending

afterEach(() => {
  resetOnboardingUserState()
})

describe('the signal channel', () => {
  it('tells the reporter nothing', () => {
    // The signature is the guard: one id in, nothing out. A reporting site cannot learn whether a tour
    // is running, cannot read a step index, and therefore cannot branch on either — which is why the
    // writing flow behaves identically with and without a run.
    expect(reportSequenceSignal('writing-flow-opened')).toBeUndefined()
  })

  it('is inert with nobody listening', () => {
    // No run active means no host draining the slot. The report lands and stops there: nothing advances,
    // nothing is recorded, and the next account cannot inherit it (see the reset below).
    reportSequenceSignal('split-succeeded')
    expect(pending()?.signal).toBe('split-succeeded')
    expect(takeOnboardingStart(false)).toBeNull()
  })

  it('holds one slot, so N identical reports are worth one advance', () => {
    // A duplicate press or a re-fired promise arm overwrites rather than queues, so the host derives at
    // most one `ADVANCE` from a burst — and the engine's index echo drops whatever arrives stale.
    reportSequenceSignal('launch-succeeded')
    const first = pending()
    reportSequenceSignal('launch-succeeded')
    const second = pending()
    expect(second?.signal).toBe('launch-succeeded')
    // Distinguishable even though the signal is identical, so a subscriber comparing values still sees
    // the second write.
    expect(second?.nonce).toBeGreaterThan(first?.nonce ?? 0)
  })

  it('clears when the host has consumed it', () => {
    reportSequenceSignal('writing-flow-opened')
    useOnboardingSignalStore.getState().clear()
    expect(pending()).toBeNull()
  })

  it('cannot cross an account boundary', () => {
    reportSequenceSignal('writing-flow-opened')
    resetOnboardingUserState()
    expect(pending()).toBeNull()
  })
})

describe('what a finished run leaves behind', () => {
  it('leaves nothing, whether it completed, was skipped or was abandoned', () => {
    // The three outcomes are deliberately indistinguishable in their after-state. There is no "already
    // seen" fact anywhere for them to differ in — which is also why a skip needs no confirmation and is
    // never re-offered.
    reportSequenceSignal('launch-succeeded')
    resetOnboardingUserState()
    expect(pending()).toBeNull()
    expect(takeOnboardingStart(false)).toBeNull()
  })
})
