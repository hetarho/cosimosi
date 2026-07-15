import { create } from 'zustand'

// The open channel between a delete/letting-go affordance and the deletion-flow sheet (§3.2 data,
// the recall-target-store precedent): a host records which act to open, the sheet subscribes on a
// non-null target and opens, then clears it when the flow closes. A one-slot request, not a queue;
// module-level so it survives the route change between the universe and the diary reader (the sheet
// is mounted on both). Full delete is keyed by diary ([X1]); letting-go by episodic memory ([X6]).
export type DeletionTarget =
  | { readonly mode: 'delete'; readonly diaryId: string }
  | { readonly mode: 'letGo'; readonly episodicMemoryId: string }

export interface DeletionTargetState {
  readonly target: DeletionTarget | null
  openFullDelete: (diaryId: string) => void
  openLetGo: (episodicMemoryId: string) => void
  clear: () => void
}

export const useDeletionTargetStore = create<DeletionTargetState>()((set) => ({
  target: null,
  openFullDelete: (diaryId) => set({ target: { mode: 'delete', diaryId } }),
  openLetGo: (episodicMemoryId) => set({ target: { mode: 'letGo', episodicMemoryId } }),
  clear: () => set({ target: null }),
}))
