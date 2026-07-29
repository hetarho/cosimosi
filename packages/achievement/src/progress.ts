import type { AchievementView } from './achievement.ts'

// Display arithmetic over two server integers, and nothing more. There is no condition here, no
// threshold table and no evaluation: `progress` and `target` arrive resolved and this only shapes
// them for a meter.

// The meter's own geometry lives with the meter (`packages/ui`'s Progress pair), not here: a ratio
// computed in one place and a track drawn in another are two copies of one invariant, and the number
// printed beside the bar could drift from the bar.

// The three states a row can be in, and the only ones. `claimable` is the single state that carries
// an affordance.
export type ClaimState = 'locked' | 'claimable' | 'claimed'

// claimState is derived from the TWO SERVER BOOLEANS and nothing else — no local "optimistically
// claimed" flag anywhere, so a failed claim cannot leave a row looking paid. `claimed` wins over
// `achieved` because a claimed row is necessarily achieved and the reward is already gone.
export function claimState(entry: Pick<AchievementView, 'achieved' | 'claimed'>): ClaimState {
  if (entry.claimed) return 'claimed'
  return entry.achieved ? 'claimable' : 'locked'
}

// claimableCount is the one summary the tab shows. Counted from the same booleans, so it cannot
// disagree with the rows under it.
export function claimableCount(entries: readonly AchievementView[]): number {
  return entries.filter((entry) => claimState(entry) === 'claimable').length
}
