export const ME_TABS = [
  'profile',
  'mood-colors',
  'stardust',
  'achievements',
  'diary',
  'account',
] as const

export type MeTabId = (typeof ME_TABS)[number]
