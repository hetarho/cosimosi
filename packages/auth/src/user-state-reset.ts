import { resetMoodPalette } from '@cosimosi/emotion'
import { resetStoreUserState } from '@cosimosi/store'
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
  // Colors are per-user, so the previous account's must be off the render seam before the next
  // account's read applies its own — otherwise the incoming universe flashes someone else's sky.
  { name: 'palette', reset: () => resetMoodPalette() },
  // A live decoration preview belongs to the account that opened it: the incoming universe must not
  // open wearing the previous user's sky, not even for a frame.
  { name: 'store', reset: resetStoreUserState },
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
