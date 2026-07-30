import { AchievementAxis, type AchievementEntry } from '@cosimosi/api-client'

// The FE mirror of one achievement.v1 AchievementEntry (§3.4 proto→domain). Every field here is a
// SERVER answer: the target, the progress, the reward amount and the two state booleans arrive
// already resolved, and this surface computes none of them — the server is the only evaluator.
//
// There is deliberately nothing here that names an EpisodicMemory, a mood, a position, a strength or a
// gist stage: an achievement is counted from those facts but never carries one ([A6][I11]).
export interface AchievementView {
  id: string
  axis: AchievementAxis
  target: number
  progress: number
  rewardTwinkle: number
  rewardOrnamentId: string
  achieved: boolean
  claimed: boolean
  // Whether the claimed reward actually landed. Separate from `claimed` because the server stamps
  // the claim before it moves any credit, so the two answers genuinely differ in the window between.
  rewardSettled: boolean
}

export { AchievementAxis }

// toAchievementView narrows the wire DTO's int64 (bigint) fields to numbers. Safe by construction:
// every one is a small count, a tier amount or a catalog target — none can approach 2^53.
export function toAchievementView(entry: AchievementEntry): AchievementView {
  return {
    id: entry.achievementId,
    axis: entry.axis,
    target: Number(entry.target),
    progress: Number(entry.progress),
    rewardTwinkle: Number(entry.rewardTwinkle),
    rewardOrnamentId: entry.rewardOrnamentId,
    achieved: entry.achieved,
    claimed: entry.claimed,
    rewardSettled: entry.rewardSettled,
  }
}

// groupByAxis cuts the flat list into headings and does NOTHING else. Groups appear in the order their
// first row arrived, and rows keep their incoming order inside a group — so the rendered order is the
// server's, exactly.
//
// It is deliberately not a walk over a local axis list. That would reorder the response to match the
// client's idea of the order, and worse, it would DROP an axis the client does not know yet — an
// achieved, unclaimed row on a newly added axis would silently not render, and its reward could never
// be claimed. Deriving the groups from the response cannot lose a row.
export function groupByAxis(
  entries: readonly AchievementView[],
): readonly { axis: AchievementAxis; entries: readonly AchievementView[] }[] {
  const groups: { axis: AchievementAxis; entries: AchievementView[] }[] = []
  const byAxis = new Map<AchievementAxis, AchievementView[]>()
  for (const entry of entries) {
    let bucket = byAxis.get(entry.axis)
    if (!bucket) {
      bucket = []
      byAxis.set(entry.axis, bucket)
      groups.push({ axis: entry.axis, entries: bucket })
    }
    bucket.push(entry)
  }
  return groups
}
