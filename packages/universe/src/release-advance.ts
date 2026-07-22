import type { AdvanceAnnouncement } from './advance-interval.ts'
import { useLaunchedNeuronsStore } from './launched-neurons-store.ts'
import { syncUniverseClock } from './sync-universe-clock.ts'
import { useUniverseClockStore } from './universe-clock-store.ts'

// The reveal, released when the acceleration completes ([T2] case 1: accelerate → then the
// launched memory appears) — and idempotent, so the overlay may also call it on an interrupted
// sweep without double-effects:
// - the clock mirror lands on the interval's end only when that is *forward* of the current value
//   ([I10] monotonic — a slow release can't rewind the HUD behind a newer date the GetUniverse
//   refetch already wrote);
// - the awaken ids UNION into the launched-neurons store rather than replace it, so a release can't
//   clobber an immediate same-day announce still waiting for the canvas; an empty reveal is a no-op
//   (nothing to awaken, and no needless canvas re-render).
export function releaseAdvance(announcement: AdvanceAnnouncement): void {
  const { currentUniverseTime } = useUniverseClockStore.getState()
  if (currentUniverseTime === null || announcement.interval.current > currentUniverseTime) {
    syncUniverseClock(announcement.interval.current)
  }
  if (announcement.revealNeuronIds.length === 0) return
  const store = useLaunchedNeuronsStore.getState()
  store.announce([...new Set([...store.newNeuronIds, ...announcement.revealNeuronIds])])
}
