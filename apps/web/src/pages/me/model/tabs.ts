// The five tabs of the account home, in this order. 계정 is NOT one of them: the identity, the linked
// ways in, sign-out and withdrawal are facts about the same person the profile tab is already about,
// and splitting them across two tabs made a reader hunt for their own email in the tab that does not
// say 프로필. They sit at the FOOT of the profile instead — last, because leaving is the last thing a
// surface should offer.
export const ME_TABS = ['profile', 'mood-colors', 'stardust', 'achievements', 'diary'] as const

export type MeTabId = (typeof ME_TABS)[number]
