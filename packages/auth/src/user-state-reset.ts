import { invalidateUserScope } from './completion-scope.ts'

export interface PlatformUserStateReset {
  name: string
  reset: (nextScopeKey: string) => void
}

// Not everything cleared on a scope change is a leg, and one thing deliberately is not: the
// session-scoped toast entries. A leg is a plain `(nextScopeKey) => void` over a module-level store,
// while the toast queue is React context — reachable only from a component. Its drop therefore lives
// in each app's client-cache provider, in the same `onScopeChange` callback that calls this function.
// A reader looking for "everything cleared on scope change" needs both halves.
/**
 * Advances the user-scope generation, then runs the app's product legs in order and the final
 * platform-specific leg. The generation moves first and here, not in a leg, so an in-flight
 * completion is fenced whichever product legs an app registers. Auth itself holds no product state:
 * the legs belong to the packages that own each store, composed by the app.
 */
export function resetUserState(
  nextScopeKey: string,
  platformLeg: PlatformUserStateReset,
  productLegs: readonly PlatformUserStateReset[] = [],
): void {
  invalidateUserScope()
  for (const entry of productLegs) entry.reset(nextScopeKey)
  platformLeg.reset(nextScopeKey)
}
