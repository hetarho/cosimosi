// Pure I/O contract for the force-directed layout (Architecture §3.2/§3.4). This
// file (and sim.ts / octree.ts) MUST NOT import three / React / DOM — it is the
// mobile-shareable simulation core; only worker.ts + the index worker-factory
// touch web APIs. Star coordinates EMERGE here from the weighted graph
// (constitution §3), they are never authoritative on the server.

export interface SimNode {
  id: string
  /** Existing/settled star → its (x,y,z) is authoritative and (unless it is a
   *  1-hop neighbor of a new node) it does not move. New stars use pinned=false. */
  pinned: boolean
  x: number
  y: number
  z: number
}

export interface SimEdge {
  source: string
  target: string
  /** weight ∈ [0,1]; stronger links pull their endpoints closer. */
  weight: number
}

export interface SimGraph {
  nodes: SimNode[]
  edges: SimEdge[]
}

export interface SimParams {
  /** Barnes-Hut approximation threshold (s/d). Default 0.9. */
  theta: number
  /** Repulsion charge (negative). Default -30. */
  repulsion: number
  /** Target edge rest length. Default 30. */
  linkDistance: number
  /** Pull toward the origin. Default 0.01. */
  centerGravity: number
  /** Velocity damping (friction) per tick. Default 0.6. */
  velocityDecay: number
  /** Convergence floor: below this alpha the layout is settled. Default 0.001. */
  alphaMin: number
}
