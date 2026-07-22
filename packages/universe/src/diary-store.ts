import { create } from 'zustand'

// A still-live memory this diary launched ([D3]): the split membership the archive shows as a
// chip (name + mood color). Soft-deleted memories are excluded server-side, so an all-let-go
// diary carries an empty list.
export interface DiarySplitMember {
  readonly episodicMemoryId: string
  readonly name: string
  /** Bare mood enum name (e.g. "JOY"); the app maps it to a color/label ([I3]). */
  readonly mood: string
}

// The immutable Diary read-model ([D2][I2]): the objective record, body returned verbatim. Its
// stars may have decayed or been let go since; the diary itself never changes.
export interface Diary {
  readonly id: string
  readonly body: string
  readonly diaryDate: string
  readonly createdUniverseTime: string
  readonly memories: readonly DiarySplitMember[]
}

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
