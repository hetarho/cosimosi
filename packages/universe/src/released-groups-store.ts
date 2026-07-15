import { create } from 'zustand'

import type { EpisodicMemory } from '@cosimosi/memory'

// A soft-deleted diary release group inside its restore window ([X2]). Its `deletedAt` (real-clock
// UTC) + the config retention days derive the remaining window; the captured `removedMemories` are
// the read-model snapshots re-inserted on an optimistic restore. Populated from the Release
// response only — this session cannot read prior sessions' releases (there is no GetReleaseGroups
// read), so a fresh reload lists nothing here (an accepted v1 limitation).
export interface ReleasedGroup {
  readonly diaryId: string
  readonly deletedAt: string
  readonly episodicMemoryIds: readonly string[]
  readonly removedMemories: readonly EpisodicMemory[]
}

export interface ReleasedGroupsState {
  readonly groups: readonly ReleasedGroup[]
  /** Record (or replace by diaryId) a just-released group so the restore surface can list it. */
  record: (group: ReleasedGroup) => void
  /** Drop a group once its diary is restored (or its window has closed). */
  drop: (diaryId: string) => void
  reset: () => void
}

export const useReleasedGroupsStore = create<ReleasedGroupsState>()((set) => ({
  groups: [],
  record: (group) =>
    set((state) => ({
      groups: [...state.groups.filter((existing) => existing.diaryId !== group.diaryId), group],
    })),
  drop: (diaryId) =>
    set((state) => ({ groups: state.groups.filter((group) => group.diaryId !== diaryId) })),
  reset: () => set({ groups: [] }),
}))
