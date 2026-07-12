import { create } from 'zustand'

// The open channel between the star-detail panel's 회고하기 intent and the recall flow (§3.2 data):
// the panel records the requested episodic memory id here, the recall-flow widget subscribes and
// opens on a non-null id, then clears it when the flow closes. A one-slot request, not a queue.
export interface RecallTargetState {
  readonly memoryId: string | null
  request: (memoryId: string) => void
  clear: () => void
}

export const useRecallTargetStore = create<RecallTargetState>()((set) => ({
  memoryId: null,
  request: (memoryId) => set({ memoryId }),
  clear: () => set({ memoryId: null }),
}))
