import { useSequenceAnchorRegistry } from './anchor-registry.ts'

/**
 * Clears every user-owned singleton in this package while the auth scope boundary withholds
 * consumers. The demo needs nothing from this — it mounts no server-backed mirror and holds no
 * session — but the onboarding tour runs inside a real one, where an unregistered module-level store
 * would leak one account's registered controls into the next account's subtree.
 *
 * The run itself needs no entry: it lives in a host-owned actor that dies with the host.
 */
export function resetSequenceUserState(): void {
  useSequenceAnchorRegistry.getState().reset()
}
