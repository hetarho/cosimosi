import { useUniverseClockStore } from '@cosimosi/universe'

// entities/universe-clock api: maps the GetUniverse read's universeTime into the shared clock
// mirror. No request of its own — the value rides the fetch the canvas widget already makes; nil
// means an empty universe whose clock is not yet born ([T5]), so the mirror clears (and a signed-out
// empty read can't leak a prior user's clock).
export function syncUniverseClock(universeTime: string | null): void {
  const store = useUniverseClockStore.getState()
  if (universeTime === null) store.clear()
  else store.setCurrent(universeTime)
}
