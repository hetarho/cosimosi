import type { AchievementView } from './achievement.ts'

// Display arithmetic over two server integers, and nothing more. There is no condition here, no
// threshold table and no evaluation: `progress` and `target` arrive resolved and this only shapes
// them for a meter.

// The meter's own geometry lives with the meter (`packages/ui`'s Progress pair), not here: a ratio
// computed in one place and a track drawn in another are two copies of one invariant, and the number
// printed beside the bar could drift from the bar.

// The four states a row can be in, and the only ones. Two of them carry an affordance: `claimable`
// asks for the reward, and `unpaid` asks again for one whose claim was recorded but whose credit
// never landed.
export type ClaimState = 'locked' | 'claimable' | 'unpaid' | 'claimed'

// claimState is derived from the THREE SERVER BOOLEANS and nothing else — no local "optimistically
// claimed" flag anywhere, so a failed claim cannot leave a row looking paid. `unpaid` is tested
// before `claimed` because both are claimed rows and only the settled one is finished; collapsing
// them is what let a stranded reward render as received.
export function claimState(
  entry: Pick<AchievementView, 'achieved' | 'claimed' | 'rewardSettled'>,
): ClaimState {
  if (entry.claimed) return entry.rewardSettled ? 'claimed' : 'unpaid'
  return entry.achieved ? 'claimable' : 'locked'
}

// claimableCount is the one summary the tab shows. It counts both affordance-carrying states, so the
// number matches the buttons visible under it: an unpaid row is a reward still waiting to arrive, and
// omitting it would say "nothing waiting" above a row asking to be pressed.
export function claimableCount(entries: readonly AchievementView[]): number {
  return entries.filter((entry) => {
    const state = claimState(entry)
    return state === 'claimable' || state === 'unpaid'
  }).length
}
