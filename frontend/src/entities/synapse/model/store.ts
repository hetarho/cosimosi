// Synapse edge store + GetUniverse mapper + neighbor selector (spec 11). 10 ignored
// GetUniverse.synapses; 11 loads them here. zustand is fine in model (RN-compatible);
// no three/DOM. brightness/reinforcedRecency default until 12 wires real activation.
import { create } from 'zustand'
import type { LinkType, SynapseEdge } from './types'

/** The subset of proto GetUniverse Synapse we map. */
export interface UniverseSynapse {
  aId: string
  bId: string
  weight: number
  linkType: string
  lastActivatedAt: string
}

const LINK_TYPES: LinkType[] = ['semantic', 'temporal', 'entity', 'co_recall']

/** proto synapse → domain SynapseEdge. brightness defaults to 1 and
 *  reinforcedRecency to 0 until spec 12 derives them from activation. */
export function toSynapseEdge(s: UniverseSynapse): SynapseEdge {
  return {
    aId: s.aId,
    bId: s.bId,
    weight: s.weight,
    brightness: 1,
    reinforcedRecency: 0,
    linkType: (LINK_TYPES as string[]).includes(s.linkType) ? (s.linkType as LinkType) : 'semantic',
  }
}

interface SynapseState {
  edges: SynapseEdge[]
  setEdges: (edges: SynapseEdge[]) => void
}

export const useSynapseStore = create<SynapseState>((set) => ({
  edges: [],
  setEdges: (edges) => set({ edges }),
}))

/** Pure: edges incident to memoryId (for neighbor navigation). */
export function neighborsOf(edges: SynapseEdge[], memoryId: string): SynapseEdge[] {
  return edges.filter((e) => e.aId === memoryId || e.bId === memoryId)
}
