// The React binding seam, split from the pure entry so a non-React consumer (a test, a script) can
// import the mirror without pulling in react-query — the shape @cosimosi/twinkle already uses.
export { useAchievements, useInvalidateAchievements } from './react/achievements.ts'
export { useClaimAchievement, type ClaimOutcome } from './react/claim.ts'
export { useAchievementUnlockNotice, type UnlockNotice } from './react/unlock-notice.ts'
