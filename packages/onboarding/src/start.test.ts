import { afterEach, describe, expect, it } from 'vitest'

import { requestOnboardingReplay, takeOnboardingStart } from './start.ts'
import { resetOnboardingUserState } from './user-state-reset.ts'

afterEach(() => {
  resetOnboardingUserState()
})

describe('the exposure policy', () => {
  it('starts on the signup completion, once', () => {
    expect(takeOnboardingStart(true)).toBe('signup')
    // The caller's own take-once read is what makes the second visit false; nothing here remembers.
    expect(takeOnboardingStart(false)).toBeNull()
  })

  it('starts on a replay request, once', () => {
    requestOnboardingReplay()
    expect(takeOnboardingStart(false)).toBe('replay')
    expect(takeOnboardingStart(false)).toBeNull()
  })

  it('starts nothing on an ordinary later arrival', () => {
    expect(takeOnboardingStart(false)).toBeNull()
  })

  it('drops a replay request the winning signup trigger did not use', () => {
    // Otherwise the unconsumed request would open a second tour on the next mount.
    requestOnboardingReplay()
    expect(takeOnboardingStart(true)).toBe('signup')
    expect(takeOnboardingStart(false)).toBeNull()
  })

  it('cannot carry a pending replay across an account boundary', () => {
    requestOnboardingReplay()
    resetOnboardingUserState()
    expect(takeOnboardingStart(false)).toBeNull()
  })
})
