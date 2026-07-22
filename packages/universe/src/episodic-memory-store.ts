import { create } from 'zustand'

import type { EpisodicMemory } from '@cosimosi/memory'

export interface EpisodicMemoryState {
  byId: Readonly<Record<string, EpisodicMemory>>
  ids: readonly string[]
  setAll: (memories: readonly EpisodicMemory[]) => void
  clear: () => void
}

// Data store (§3.2): the episodic-memory collection keyed by id, populated once per
// GetUniverse fetch (Query cache → store). Never read per frame — per-frame consumers
// read the coordinate buffer and machine snapshots, not this store.
export const useEpisodicMemoryStore = create<EpisodicMemoryState>()((set) => ({
  byId: {},
  ids: [],
  setAll: (memories) =>
    set({
      byId: Object.fromEntries(memories.map((memory) => [memory.id, memory])),
      ids: memories.map((memory) => memory.id),
    }),
  clear: () => set({ byId: {}, ids: [] }),
}))
