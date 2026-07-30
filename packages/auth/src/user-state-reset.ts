import { resetMoodPalette } from '@cosimosi/emotion'
import { resetOnboardingUserState } from '@cosimosi/onboarding'
import { resetSequenceUserState } from '@cosimosi/sequence'
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
  // The anchor registry is module-level, so an onboarding run's registered controls would otherwise
  // survive into the next account's subtree and let a tour point at a control that is no longer there.
  { name: 'sequence', reset: () => resetSequenceUserState() },
  // A pending replay request would open a tour in the incoming account's universe, and an unconsumed
  // signal report would advance it — both are module-level and both belong to whoever was signed in.
  { name: 'onboarding', reset: () => resetOnboardingUserState() },
  { name: 'signup-completion', reset: resetSignupUserState },
]

/** The platform-pure stores cleared for every authenticated scope transition. */
export const USER_STATE_RESET_INVENTORY: readonly string[] = Object.freeze(
  USER_STATE_RESET_REGISTRY.map(({ name }) => name),
)

export function extendUserStateResetInventory(platformLeg: PlatformUserStateReset): string[] {
  return [...USER_STATE_RESET_INVENTORY, platformLeg.name]
}

// Not everything cleared on a scope change is in this registry, and one thing deliberately is not:
// the session-scoped toast entries. An entry here is a plain `(nextScopeKey) => void` over a
// module-level store, while the toast queue is React context — reachable only from a component. Its
// drop therefore lives in each app's client-cache provider, in the same `onScopeChange` callback that
// calls this function. A reader looking for "everything cleared on scope change" needs both halves.
/** Clears shared user state in one order, then delegates the final platform-specific leg. */
export function resetUserState(nextScopeKey: string, platformLeg: PlatformUserStateReset): void {
  for (const entry of USER_STATE_RESET_REGISTRY) entry.reset(nextScopeKey)
  platformLeg.reset(nextScopeKey)
}
