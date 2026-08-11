import { create } from 'zustand'
import type { Diary } from '@cosimosi/memory'

export interface DiaryState {
  byId: Readonly<Record<string, Diary>>
  ids: readonly string[]
  setAll: (diaries: readonly Diary[]) => void
  /** Add entries a NARROWER read turned up, leaving the ordered page this store already holds. */
  add: (diaries: readonly Diary[]) => void
  clear: () => void
}

// Data store (§3.2): the diary archive keyed by id, populated from the GetDiaries read (Query
// cache → store). Reverse-chronological order is the server's; `ids` preserves the order the
// pages arrived in. Read by the reader block, never per frame — reading a diary is free ([D2]).
//
// `setAll` is the page-owning read's write and `add` is every other read's: one screen may hold both
// a paged archive and a narrower read beside it, and a second `setAll` would leave every consumer
// holding one day of an archive. Anything looked up by id — the deletion confirm's affected list —
// needs the union, not the most recent answer.
export const useDiaryStore = create<DiaryState>()((set) => ({
  byId: {},
  ids: [],
  setAll: (diaries) =>
    set({
      byId: Object.fromEntries(diaries.map((diary) => [diary.id, diary])),
      ids: diaries.map((diary) => diary.id),
    }),
  add: (diaries) =>
    set((state) => {
      const fresh = diaries.filter((diary) => !(diary.id in state.byId))
      if (fresh.length === 0 && diaries.length === 0) return state
      return {
        byId: { ...state.byId, ...Object.fromEntries(diaries.map((diary) => [diary.id, diary])) },
        ids: fresh.length === 0 ? state.ids : [...state.ids, ...fresh.map((diary) => diary.id)],
      }
    }),
  clear: () => set({ byId: {}, ids: [] }),
}))
