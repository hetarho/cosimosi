import { create } from 'zustand'
import type { Diary } from '@cosimosi/memory'

export interface DiaryState {
  byId: Readonly<Record<string, Diary>>
  ids: readonly string[]
  /** The page-owning segment, kept separately so narrower reads can be replaced independently. */
  ownerById: Readonly<Record<string, Diary>>
  ownerIds: readonly string[]
  /** The current non-owning segment; retained when the owning page settles later. */
  contributedById: Readonly<Record<string, Diary>>
  contributedIds: readonly string[]
  setAll: (diaries: readonly Diary[]) => void
  /** Add or refresh contributed entries without removing earlier contributions. */
  add: (diaries: readonly Diary[]) => void
  /** Replace the current narrower read, including with an empty result. */
  replaceContributions: (diaries: readonly Diary[]) => void
  clear: () => void
}

// Data store (§3.2): the diary archive keyed by id, populated from the GetDiaries read (Query
// cache → store). Reverse-chronological order is the server's; `ids` preserves the order the
// pages arrived in. Read by the reader block, never per frame — reading a diary is free ([D2]).
//
// `setAll` replaces the page-owning segment; `replaceContributions` replaces the current narrower
// read; and `add` incrementally contributes facts. Keeping the two segments apart lets either read
// settle empty without erasing the other. Anything looked up by id — the deletion confirm's affected
// list — needs their union, not whichever response arrived last.
export const useDiaryStore = create<DiaryState>()((set) => ({
  byId: {},
  ids: [],
  ownerById: {},
  ownerIds: [],
  contributedById: {},
  contributedIds: [],
  setAll: (diaries) =>
    set((state) => {
      const ownerIds = diaries.map((diary) => diary.id)
      const ownerSet = new Set(ownerIds)
      const ownerById = Object.fromEntries(diaries.map((diary) => [diary.id, diary]))
      const retainedIds = state.contributedIds.filter((id) => !ownerSet.has(id))
      return {
        byId: {
          ...state.contributedById,
          ...ownerById,
        },
        ids: [...ownerIds, ...retainedIds],
        ownerById,
        ownerIds,
      }
    }),
  add: (diaries) =>
    set((state) => {
      // An empty response changes nothing. Non-empty duplicate IDs still refresh their facts: the
      // narrower read may have settled after the owning page and therefore be newer.
      if (diaries.length === 0) return state
      const fresh = diaries.filter((diary) => !(diary.id in state.byId))
      const contributed = diaries.filter((diary) => !state.contributedIds.includes(diary.id))
      const contributedById = {
        ...state.contributedById,
        ...Object.fromEntries(diaries.map((diary) => [diary.id, diary])),
      }
      return {
        byId: { ...state.byId, ...Object.fromEntries(diaries.map((diary) => [diary.id, diary])) },
        ids: fresh.length === 0 ? state.ids : [...state.ids, ...fresh.map((diary) => diary.id)],
        contributedById,
        contributedIds:
          contributed.length === 0
            ? state.contributedIds
            : [...state.contributedIds, ...contributed.map((diary) => diary.id)],
      }
    }),
  replaceContributions: (diaries) =>
    set((state) => {
      const contributedIds = diaries.map((diary) => diary.id)
      const ownerSet = new Set(state.ownerIds)
      const contributedById = Object.fromEntries(diaries.map((diary) => [diary.id, diary]))
      return {
        byId: { ...state.ownerById, ...contributedById },
        ids: [...state.ownerIds, ...contributedIds.filter((id) => !ownerSet.has(id))],
        contributedById,
        contributedIds,
      }
    }),
  clear: () =>
    set({
      byId: {},
      ids: [],
      ownerById: {},
      ownerIds: [],
      contributedById: {},
      contributedIds: [],
    }),
}))
