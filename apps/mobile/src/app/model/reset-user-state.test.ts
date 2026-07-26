import { pendingInvite, recordSignupCompletion, takeSignupCompletion } from '@cosimosi/auth'

import { MOBILE_USER_STATE_RESET_INVENTORY, resetMobileUserState } from './reset-user-state.ts'

describe('resetMobileUserState signup seams', () => {
  it('resets signup completion but deliberately preserves the pending invite', () => {
    pendingInvite.capture('opaque')
    recordSignupCompletion()

    resetMobileUserState('new-user')

    expect(takeSignupCompletion()).toBe(false)
    expect(pendingInvite.consume()).toBe('opaque')
    expect(MOBILE_USER_STATE_RESET_INVENTORY).toContain('signup-completion')
    expect(MOBILE_USER_STATE_RESET_INVENTORY).not.toContain('pending-invite')
  })
})
