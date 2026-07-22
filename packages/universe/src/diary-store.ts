import { create } from 'zustand'
import type { Diary } from '@cosimosi/memory'

export interface DiaryState {
  byId: Readonly<Record<string, Diary>>
  ids: readonly string[]
  setAll: (diaries: readonly Diary[]) => void
  clear: () => void
}

// Data store (§3.2): the diary archive keyed by id, populated from the GetDiaries read (Query
// cache → store). Reverse-chronological order is the server's; `ids` preserves the order the
// pages arrived in. Read by the reader block, never per frame — reading a diary is free ([D2]).
export const useDiaryStore = create<DiaryState>()((set) => ({
  byId: {},
  ids: [],
  setAll: (diaries) =>
    set({
      byId: Object.fromEntries(diaries.map((diary) => [diary.id, diary])),
      ids: diaries.map((diary) => diary.id),
    }),
  clear: () => set({ byId: {}, ids: [] }),
}))
