import { resetUniverseUserState } from '@cosimosi/universe'
import { resetTwinkleUserState } from '@cosimosi/twinkle'
import { resetPaletteSession, usePalettePreferenceStore } from '@cosimosi/emotion/react'
import { resetSignupUserState } from '@cosimosi/auth'

export const MOBILE_USER_STATE_RESET_INVENTORY = [
  'universe',
  'twinkle',
  'palette',
  'signup-completion',
] as const

/** Clears app-owned interaction state while the session boundary withholds routed children. */
export function resetMobileUserState(nextScopeKey: string): void {
  resetUniverseUserState()
  resetTwinkleUserState()
  resetPaletteSession(nextScopeKey)
  usePalettePreferenceStore.getState().reset()
  resetSignupUserState()
}
