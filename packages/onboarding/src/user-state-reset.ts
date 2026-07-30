import { useOnboardingSignalStore } from './signal-channel.ts'
import { clearOnboardingStart } from './start.ts'

/**
 * Clears every user-owned singleton in this package while the auth scope boundary withholds consumers.
 *
 * Both are module-level and both belong to whoever was signed in: a pending replay request would open
 * a tour in the next account's universe, and an unconsumed signal report would advance it. The run
 * itself needs no entry — it lives in a host-owned actor that dies with the host.
 */
export function resetOnboardingUserState(): void {
  clearOnboardingStart()
  useOnboardingSignalStore.getState().clear()
}
