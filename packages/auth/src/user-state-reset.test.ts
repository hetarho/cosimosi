import { describe, expect, it } from 'vitest'

import { pendingInvite } from './pending-invite.ts'
import { recordSignupCompletion, takeSignupCompletion } from './signup-completion.ts'
import {
  extendUserStateResetInventory,
  resetUserState,
  USER_STATE_RESET_INVENTORY,
} from './user-state-reset.ts'

describe('user state reset registry', () => {
  it('runs the shared inventory and the one platform leg for every app', () => {
    pendingInvite.capture('opaque')
    recordSignupCompletion()
    const platformScopes: string[] = []
    const signupCompletionAtPlatformLeg: boolean[] = []
    const localeLeg = {
      name: 'locale',
      reset: (nextScopeKey: string) => {
        platformScopes.push(nextScopeKey)
        signupCompletionAtPlatformLeg.push(takeSignupCompletion())
      },
    }

    resetUserState('new-user', localeLeg)

    expect(takeSignupCompletion()).toBe(false)
    expect(pendingInvite.consume()).toBe('opaque')
    expect(platformScopes).toEqual(['new-user'])
    expect(signupCompletionAtPlatformLeg).toEqual([false])
    expect(USER_STATE_RESET_INVENTORY).toEqual([
      'universe',
      'twinkle',
      'palette',
      'store',
      'sequence',
      'onboarding',
      'signup-completion',
    ])
    expect(extendUserStateResetInventory(localeLeg)).toEqual([
      ...USER_STATE_RESET_INVENTORY,
      'locale',
    ])
  })
})
