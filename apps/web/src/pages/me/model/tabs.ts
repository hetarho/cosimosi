export const ME_TABS = ['profile', 'stardust', 'achievements', 'diary', 'account'] as const

export type MeTabId = (typeof ME_TABS)[number]

export function parseMeTab(value: unknown): MeTabId {
  return typeof value === 'string' && (ME_TABS as readonly string[]).includes(value)
    ? (value as MeTabId)
    : 'profile'
}
