import { resetUniverseUserState } from '@cosimosi/universe'
import { resetTwinkleUserState } from '@cosimosi/twinkle'
import { resetPaletteSession, usePalettePreferenceStore } from '@cosimosi/emotion/react'

export const WEB_USER_STATE_RESET_INVENTORY = ['universe', 'twinkle', 'palette'] as const

/** Clears app-owned interaction state while the session boundary withholds routed children. */
export function resetWebUserState(nextScopeKey: string): void {
  resetUniverseUserState()
  resetTwinkleUserState()
  resetPaletteSession(nextScopeKey)
  usePalettePreferenceStore.getState().reset()
}
