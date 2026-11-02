import { useEffect } from 'react'

import { resetMoodPalette } from '@cosimosi/emotion'
import { resetUniverseUserState } from '@cosimosi/universe'

// The demo is a sandbox over the product's module-level stores, not another account. Entering and
// leaving clear them through the universe and palette seams, which never advance the user-scope
// generation, so a signed-in visitor's in-flight completions still land when they come back.
export function useDemoSandbox(runId: string, startRun: (runId: string) => void): void {
  // Entering starts the tour EVERY time, and a second mount in the same tab replays the awaken:
  // `useAwakenRegistryStore` is a module-level idempotency registry that survives remounts, so
  // without this reset a replay would silently skip the birth choreography it exists to show.
  // `startRun` and the entry are both stable for the life of the mount, so this runs once per entry.
  useEffect(() => {
    resetUniverseUserState()
    startRun(runId)
  }, [runId, startRun])

  // Nothing carries over. Both stores are module-level and outlive the route, so a tasted palette
  // would otherwise bleed into the landing page or the next session's first paint.
  useEffect(
    () => () => {
      resetUniverseUserState()
      resetMoodPalette()
    },
    [],
  )
}
