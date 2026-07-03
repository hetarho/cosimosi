// Cross-import surface (§3.1 @x): the domain facts a rendering entity may read from this
// mirror slice. Domain re-exports only — the projection is one-way, so no visual word travels
// back into this slice [A2].
export { useEpisodicMemoryStore, type EpisodicMemoryState } from '../model/episodic-memory-store.ts'
export type { EpisodicMemory } from '@cosimosi/memory'
