// @cosimosi/achievement — the platform-pure 업적 mirror both apps consume verbatim.
//
// It holds the DTO mirror, the id→copy projection, display arithmetic and the unlock diff. It holds
// NO condition table, NO target and NO evaluation: the server is the only evaluator, so there is
// nothing here for a client to disagree with (contrast the ledger's price curves, which the FE must
// recompute pre-spend).
//
// It also depends on nothing that knows what a memory is — no `@cosimosi/memory`, `-logic`,
// `universe`, `emotion`, `store` or `3d-renderer` — which is the package-manifest half of the [A6]
// guard: an achievement surface cannot reach a meaning-layer field because it cannot import one.
export {
  AchievementAxis,
  groupByAxis,
  toAchievementView,
  type AchievementView,
} from './achievement.ts'
export {
  achievementBody,
  achievementTitle,
  axisLabel,
  hasAchievementCopy,
} from './achievement-copy.ts'
export { claimState, claimableCount, type ClaimState } from './progress.ts'
export {
  achievedSnapshot,
  newlyAchieved,
  unlockNoticeToasts,
  type AchievedSnapshot,
  type UnlockNoticeToast,
} from './unlock-diff.ts'
