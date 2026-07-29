import type { AchievementView } from './achievement.ts'

// The unlock notice is a DIFF OF A READ, never a push ([A5]): the recorder returns `error` alone, so
// nothing can be pushed back through a write, and there is no subscription and no polling anywhere.
// This is the whole detection mechanism.

// A snapshot of what was achieved last time the list resolved. A map rather than a list because the
// diff is a membership question, and `undefined` is meaningful — see below.
export type AchievedSnapshot = ReadonlyMap<string, boolean>

export function achievedSnapshot(entries: readonly AchievementView[]): AchievedSnapshot {
  return new Map(entries.map((entry) => [entry.id, entry.achieved]))
}

// newlyAchieved is the ids that flipped from not-achieved to achieved and are still unclaimed.
//
// `newlyAchieved(undefined, next)` is `[]` BY CONSTRUCTION, and that is the whole reason the previous
// snapshot is optional: the first resolution of a session has nothing to compare against, so a
// returning user with unclaimed achievements must see no toast burst at sign-in. Treating an absent
// snapshot as "nothing was achieved" would announce their entire history.
//
// There is no clock in here. A notice is not "recent" — it is "changed since the last read".
export function newlyAchieved(
  previous: AchievedSnapshot | undefined,
  next: readonly AchievementView[],
): readonly AchievementView[] {
  if (!previous) return []
  return next.filter(
    (entry) => entry.achieved && !entry.claimed && previous.get(entry.id) === false,
  )
}
