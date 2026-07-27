import { resetPaletteSession, usePalettePreferenceStore } from '@cosimosi/emotion/react'
import { resetTwinkleUserState } from '@cosimosi/twinkle'
import { resetUniverseUserState } from '@cosimosi/universe'

import { resetSignupUserState } from './signup-completion.ts'

interface UserStateResetEntry {
  name: string
  reset: (nextScopeKey: string) => void
}

export type PlatformUserStateReset = UserStateResetEntry

const USER_STATE_RESET_REGISTRY: readonly UserStateResetEntry[] = [
  { name: 'universe', reset: resetUniverseUserState },
  { name: 'twinkle', reset: resetTwinkleUserState },
  {
    name: 'palette',
    reset: (nextScopeKey) => {
      resetPaletteSession(nextScopeKey)
      usePalettePreferenceStore.getState().reset()
    },
  },
  { name: 'signup-completion', reset: resetSignupUserState },
]

/** The platform-pure stores cleared for every authenticated scope transition. */
export const USER_STATE_RESET_INVENTORY: readonly string[] = Object.freeze(
  USER_STATE_RESET_REGISTRY.map(({ name }) => name),
)

export function extendUserStateResetInventory(platformLeg: PlatformUserStateReset): string[] {
  return [...USER_STATE_RESET_INVENTORY, platformLeg.name]
}

/** Clears shared user state in one order, then delegates the final platform-specific leg. */
export function resetUserState(nextScopeKey: string, platformLeg: PlatformUserStateReset): void {
  for (const entry of USER_STATE_RESET_REGISTRY) entry.reset(nextScopeKey)
  platformLeg.reset(nextScopeKey)
}
