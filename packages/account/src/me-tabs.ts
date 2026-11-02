// The five tabs of the account home (ACCT-9), in this order, for both apps. 계정 is NOT one of them:
// the identity, the linked ways in, sign-out and withdrawal are facts about the same person the
// profile tab is already about, so they sit at the FOOT of the profile instead — last, because
// leaving is the last thing a surface should offer.
export const ME_TABS = ['profile', 'mood-colors', 'stardust', 'achievements', 'diary'] as const

export type MeTabId = (typeof ME_TABS)[number]
