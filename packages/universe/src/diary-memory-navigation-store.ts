import { create } from 'zustand'
export interface DiaryMemoryNavigationState {
  readonly memoryIds: readonly string[]
  start: (memoryIds: readonly string[]) => void
  clear: () => void
}
export const useDiaryMemoryNavigationStore = create<DiaryMemoryNavigationState>()((set) => ({
  memoryIds: [],
  start: (memoryIds) => set({ memoryIds: [...new Set(memoryIds)] }),
  clear: () => set({ memoryIds: [] }),
}))
