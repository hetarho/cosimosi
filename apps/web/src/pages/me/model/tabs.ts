export const ME_TABS = ['profile', 'stardust', 'achievements', 'diary', 'account'] as const

export type MeTabId = (typeof ME_TABS)[number]
