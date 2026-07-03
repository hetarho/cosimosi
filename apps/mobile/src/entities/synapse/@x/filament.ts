// Cross-import surface (§3.1 @x): the domain facts a rendering entity may read from this
// mirror slice. Domain re-exports only — the projection is one-way [A2].
export { useSynapseStore, type SynapseState } from '../model/synapse-store.ts'
export type { Synapse } from '@cosimosi/memory'
