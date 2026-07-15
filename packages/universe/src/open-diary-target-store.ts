import { create } from 'zustand'

// The open channel between the star-detail panel's 원본 일기 보기 intent and the diary reader
// (§3.2 data, the recall-target-store precedent): the panel records the episodic memory whose
// diary to open, the reader subscribes and — once its GetDiaries data has loaded — opens the
// diary whose split membership includes that id, then clears it. A one-slot request, not a
// queue; module-level so it survives the route change from the universe to the reader.
export interface OpenDiaryTargetState {
  readonly memoryId: string | null
  request: (memoryId: string) => void
  clear: () => void
}

export const useOpenDiaryTargetStore = create<OpenDiaryTargetState>()((set) => ({
  memoryId: null,
  request: (memoryId) => set({ memoryId }),
  clear: () => set({ memoryId: null }),
}))
