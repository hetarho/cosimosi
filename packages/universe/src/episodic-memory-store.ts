import { create } from 'zustand'

import type { EpisodicMemory } from '@cosimosi/memory'

import { sameStoredCollection } from './entity-collection.ts'

export interface EpisodicMemoryState {
  byId: Readonly<Record<string, EpisodicMemory>>
  ids: readonly string[]
  setAll: (memories: readonly EpisodicMemory[]) => void
  clear: () => void
}

// Data store (§3.2): the episodic-memory collection keyed by id, populated once per
// GetUniverse fetch (Query cache → store). Never read per frame — per-frame consumers
// read the coordinate buffer and machine snapshots, not this store.
export const useEpisodicMemoryStore = create<EpisodicMemoryState>()((set, get) => ({
  byId: {},
  ids: [],
  // A content-identical write keeps the previous `byId`/`ids` references — see
  // `sameStoredCollection` for why that matters more than the write it saves.
  setAll: (memories) => {
    const { ids, byId } = get()
    const incoming = withMonotonicStages(byId, memories)
    if (sameStoredCollection(ids, byId, incoming)) return
    set({
      byId: Object.fromEntries(incoming.map((memory) => [memory.id, memory])),
      ids: incoming.map((memory) => memory.id),
    })
  },
  clear: () => set({ byId: {}, ids: [] }),
}))

// A semantic stage is one-way ([C6a]): a memory rises to its gist and never walks back down. So a
// response reporting a LOWER stage than the one already mirrored is a stale read racing a fresh one,
// and taking it would move everything derived from the stage backwards at once — the gist body's z
// lift, its diffuse softness, which rung the detail panel offers. Holding the floor here rather than
// in each consumer is what makes that one rule instead of one guard per reader.
//
// Applied BEFORE the content comparison, so a response that differs from the mirror only by a lower
// stage is recognized as no change at all and keeps the previous references.
//
// The floor is per collection, so it is released with it: `clear()` on user reset starts the next
// universe from nothing. A stage that must genuinely be corrected downward — a server-side data fix
// — arrives on the next full load. A surface that writes staged fixtures straight into this store
// must therefore release it between scenes (`setAll([])`, as the /test panel does on unmount) if it
// ever scripts a rise; replaying one from the start would otherwise find the stage held at its peak.
function withMonotonicStages(
  byId: Readonly<Record<string, EpisodicMemory>>,
  memories: readonly EpisodicMemory[],
): readonly EpisodicMemory[] {
  let lowered = false
  const raised = memories.map((memory) => {
    const mirrored = byId[memory.id]
    if (!mirrored || !(mirrored.semanticStage > memory.semanticStage)) return memory
    lowered = true
    return { ...memory, semanticStage: mirrored.semanticStage }
  })
  return lowered ? raised : memories
}
