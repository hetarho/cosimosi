// Pure Barnes-Hut force layout (spec 07). No three / React / DOM / rAF — the
// caller (08's useFrame, or the worker) pumps `tick`. Star coordinates emerge from
// the weighted graph (constitution §3). Existing stars are pinned; only a new star
// and its 1-hop neighbors move (partial placement), so adding a memory doesn't
// rearrange the whole universe (concept §결정1).
import { mulberry32 } from '@/shared/lib/prng'
import type { SimGraph, SimParams } from './types'
import { accumulateRepulsion, buildOctree } from './octree'

// Distance floor for the spring force: clamps `dist` so coincident linked nodes
// can't divide toward zero and blow up (mirrors octree's MIN_DIST2). Below the
// cluster scale (linkDistance≈30), so a normal layout is unaffected.
const MIN_DIST = 1

const DEFAULTS: SimParams = {
  theta: 0.9,
  repulsion: -30,
  linkDistance: 30,
  centerGravity: 0.01,
  velocityDecay: 0.6,
  alphaMin: 0.001,
}

// Spring strength multiplier applied on top of each edge's weight.
const LINK_STRENGTH = 1.0

/** Opaque simulation state. Coordinates live in `px` (flat [x,y,z]); node order
 *  matches the input `nodes` array 1:1 (index = InstancedMesh instance index — the
 *  08 contract). */
export interface SimState {
  ids: string[]
  // ArrayBuffer-backed (not SharedArrayBuffer) so positions().buffer is a valid
  // transferable for the worker (TS 6.0 typed-array buffer generics).
  px: Float32Array<ArrayBuffer>
  vx: Float32Array<ArrayBuffer>
  free: Uint8Array // 1 = may move, 0 = fixed
  edges: Array<{ a: number; b: number; weight: number }> // validated, index-based
  params: SimParams
  alpha: number
  alphaDecay: number
  n: number
}

export function createSim(graph: SimGraph, params?: Partial<SimParams>): SimState {
  const p: SimParams = { ...DEFAULTS, ...params }
  const nodes = graph.nodes
  const n = nodes.length

  const ids: string[] = new Array(n)
  const index = new Map<string, number>()
  const px = new Float32Array(n * 3)
  const vx = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const node = nodes[i]
    ids[i] = node.id
    index.set(node.id, i)
    px[i * 3] = node.x
    px[i * 3 + 1] = node.y
    px[i * 3 + 2] = node.z
  }

  // Validate edges: silently drop any referencing an unknown node (acceptance 1.7).
  const edges: Array<{ a: number; b: number; weight: number }> = []
  for (const e of graph.edges) {
    const a = index.get(e.source)
    const b = index.get(e.target)
    if (a === undefined || b === undefined || a === b) continue
    edges.push({ a, b, weight: e.weight })
  }

  // Free set = new nodes (!pinned) ∪ their 1-hop neighbors (no propagation).
  const free = new Uint8Array(n)
  for (let i = 0; i < n; i++) if (!nodes[i].pinned) free[i] = 1
  for (const e of edges) {
    const aNew = !nodes[e.a].pinned
    const bNew = !nodes[e.b].pinned
    if (aNew) free[e.b] = 1
    if (bNew) free[e.a] = 1
  }

  // Adjacency for initial placement of new nodes.
  const neighbors: number[][] = Array.from({ length: n }, () => [])
  for (const e of edges) {
    neighbors[e.a].push(e.b)
    neighbors[e.b].push(e.a)
  }

  // New nodes (pinned=false) start at the average of their neighbors' positions
  // plus a small deterministic jitter; with no neighbors, a small origin sphere.
  // Neighbor positions are read from a snapshot of the INPUT coords (inputPx), not
  // the live buffer being rewritten — otherwise two mutually-linked new nodes would
  // read each other's just-overwritten position and collapse together, and the
  // result would depend on node array order. Deterministic RNG → reproducible.
  const inputPx = px.slice()
  const rng = mulberry32(0x5eed)
  for (let i = 0; i < n; i++) {
    if (nodes[i].pinned) continue
    const nb = neighbors[i]
    if (nb.length > 0) {
      let sx = 0,
        sy = 0,
        sz = 0
      for (const j of nb) {
        sx += inputPx[j * 3]
        sy += inputPx[j * 3 + 1]
        sz += inputPx[j * 3 + 2]
      }
      px[i * 3] = sx / nb.length + (rng() - 0.5)
      px[i * 3 + 1] = sy / nb.length + (rng() - 0.5)
      px[i * 3 + 2] = sz / nb.length + (rng() - 0.5)
    } else {
      // small random offset near origin (sphere-ish) so nothing coincides exactly
      px[i * 3] = (rng() - 0.5) * 10
      px[i * 3 + 1] = (rng() - 0.5) * 10
      px[i * 3 + 2] = (rng() - 0.5) * 10
    }
  }

  // d3-style alpha decay so the layout settles toward alphaMin over ~300 ticks.
  const alphaDecay = 1 - Math.pow(p.alphaMin, 1 / 300)

  return { ids, px, vx, free, edges, params: p, alpha: 1, alphaDecay, n }
}

/** Advance the layout by `steps` ticks; returns the current positions snapshot. */
export function tick(state: SimState, steps = 1): Float32Array {
  for (let s = 0; s < steps; s++) {
    if (state.alpha <= state.params.alphaMin) break // settled — stop moving (1.8)
    step(state)
    state.alpha += (0 - state.alpha) * state.alphaDecay
  }
  return positions(state)
}

function step(state: SimState): void {
  const { px, vx, free, edges, params, n, alpha } = state
  const { theta, repulsion, linkDistance, centerGravity, velocityDecay } = params

  // Repulsion (Barnes-Hut). All nodes — incl. fixed — are sources, so a new star is
  // pushed by the existing cluster; only free nodes receive the force.
  const tree = buildOctree(px, n)
  const acc = { fx: 0, fy: 0, fz: 0 }
  for (let i = 0; i < n; i++) {
    if (!free[i]) continue
    acc.fx = 0
    acc.fy = 0
    acc.fz = 0
    accumulateRepulsion(tree, i, theta, repulsion, acc)
    vx[i * 3] += acc.fx * alpha
    vx[i * 3 + 1] += acc.fy * alpha
    vx[i * 3 + 2] += acc.fz * alpha
  }

  // Attraction along edges (spring toward linkDistance, scaled by weight). Fixed
  // endpoints act as anchors; only free endpoints receive the force.
  for (const e of edges) {
    const ai = e.a * 3
    const bi = e.b * 3
    const dx = px[bi] - px[ai]
    const dy = px[bi + 1] - px[ai + 1]
    const dz = px[bi + 2] - px[ai + 2]
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), MIN_DIST)
    const f = ((dist - linkDistance) / dist) * e.weight * LINK_STRENGTH * alpha
    if (free[e.a]) {
      vx[ai] += dx * f
      vx[ai + 1] += dy * f
      vx[ai + 2] += dz * f
    }
    if (free[e.b]) {
      vx[bi] -= dx * f
      vx[bi + 1] -= dy * f
      vx[bi + 2] -= dz * f
    }
  }

  // Center gravity + integrate (velocity damp → move). Fixed nodes never move.
  for (let i = 0; i < n; i++) {
    if (!free[i]) continue
    const xi = i * 3
    vx[xi] += -px[xi] * centerGravity * alpha
    vx[xi + 1] += -px[xi + 1] * centerGravity * alpha
    vx[xi + 2] += -px[xi + 2] * centerGravity * alpha

    vx[xi] *= velocityDecay
    vx[xi + 1] *= velocityDecay
    vx[xi + 2] *= velocityDecay

    px[xi] += vx[xi]
    px[xi + 1] += vx[xi + 1]
    px[xi + 2] += vx[xi + 2]
  }
}

/** Snapshot of current positions: a fresh Float32Array of length n*3 in input
 *  order (acceptance 1.4). A copy, so the caller (and worker transfer) can't
 *  detach the live buffer. */
export function positions(state: SimState): Float32Array<ArrayBuffer> {
  return state.px.slice(0, state.n * 3)
}

export function alpha(state: SimState): number {
  return state.alpha
}

export function isSettled(state: SimState): boolean {
  return state.alpha <= state.params.alphaMin
}
