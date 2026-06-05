// Pure synapse visual domain types (spec 09). No three/React/DOM (constitution §4
// — mobile reusable). Coordinates are NOT here (received via positionOf; star
// coords emerge client-side, constitution §3).

export type LinkType = 'semantic' | 'temporal' | 'entity' | 'co_recall'

export interface SynapseEdge {
  /** normalized a_id < b_id (one undirected row). */
  aId: string
  bId: string
  /** 0..1 synapse strength (server-authoritative graph). */
  weight: number
  /** = max(a_min, activation) — produced by spec 12; an input here. */
  brightness: number
  /** 0..1 recent-reinforcement (drives pulse amplitude; produced by 11/12). */
  reinforcedRecency: number
  linkType: LinkType
}
