/**
 * Inbound-link seam (ARCHITECTURE §3.5). The app root owns link parsing only to
 * the extent the shell needs (auth callbacks, future typed routes); product deep
 * links are later feature work (plan/13 non-goal). The navigation layer turns
 * these prefixes into React Navigation's typed linking config, which owns the
 * native `Linking` integration — so feature/domain slices never touch links.
 */
export const mobileLinkingPrefixes = ['cosimosi://'] as const;
