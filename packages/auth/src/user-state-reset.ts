import { invalidateUserScope } from './completion-scope.ts'
import { resetSignupUserState } from './signup-completion.ts'

interface UserStateResetEntry {
  name: string
  reset: (nextScopeKey: string) => void
}

export type PlatformUserStateReset = UserStateResetEntry

const USER_STATE_RESET_REGISTRY: readonly UserStateResetEntry[] = [
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
/**
 * Advances the user-scope generation, then clears shared user state in one order and delegates the
 * final platform-specific leg. The generation moves first and here, not in a leg, so an in-flight
 * completion is fenced whichever product legs an app registers.
 */
export function resetUserState(
  nextScopeKey: string,
  platformLeg: PlatformUserStateReset,
  productLegs: readonly PlatformUserStateReset[] = [],
): void {
  invalidateUserScope()
  for (const entry of productLegs) entry.reset(nextScopeKey)
  for (const entry of USER_STATE_RESET_REGISTRY) entry.reset(nextScopeKey)
  platformLeg.reset(nextScopeKey)
}
