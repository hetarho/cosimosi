import { resetUniverseUserState } from '@cosimosi/universe'

import { useAdvanceAnnouncementStore } from '../../features/accelerate-time/index.ts'
import {
  resetPaletteSession,
  usePalettePreferenceStore,
} from '../../features/change-palette/index.ts'
import { cancelPendingTimeSyncConsent } from '../../features/confirm-time-sync/index.ts'
import { useLaunchedNeuronsStore } from '../../features/launch-stars/index.ts'
import { useDiaryDraftStore } from '../../features/write-diary/index.ts'
import { useDeletionDraftStore } from '../../widgets/deletion-flow/index.ts'
import { useRecallDraftStore } from '../../widgets/recall-flow/index.ts'
import { useProposalStore } from '../../widgets/writing-flow/index.ts'

export const WEB_USER_STATE_RESET_INVENTORY = [
  'universe',
  'advance-announcement',
  'launched-neurons',
  'diary-draft',
  'proposal-draft',
  'recall-draft',
  'deletion-draft',
  'time-sync-consent',
  'palette',
] as const

/** Clears app-owned interaction state while the session boundary withholds routed children. */
export function resetWebUserState(nextScopeKey: string): void {
  resetUniverseUserState()
  useAdvanceAnnouncementStore.getState().reset()
  useLaunchedNeuronsStore.getState().reset()
  useDiaryDraftStore.getState().clear()
  useProposalStore.getState().reset()
  useRecallDraftStore.getState().reset()
  useDeletionDraftStore.getState().reset()
  cancelPendingTimeSyncConsent()
  resetPaletteSession(nextScopeKey)
  usePalettePreferenceStore.getState().reset()
}
