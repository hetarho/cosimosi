// Pure Barnes-Hut force layout (spec 07). No three / React / DOM / rAF — the
// caller (08's useFrame, or the worker) pumps `tick`. Star coordinates emerge from
// the weighted graph (constitution §3). Existing stars are pinned; only a new star
// and its 1-hop neighbors move (partial placement), so adding a memory doesn't
// rearrange the whole universe (concept §결정1).
import { mulberry32 } from '../prng'
import { VALUES } from '@/shared/config'
import type { SimGraph, SimParams } from './types'
import { accumulateRepulsion, buildOctree } from './octree'

// Distance floor for the spring force: clamps `dist` so coincident linked nodes
// can't divide toward zero and blow up (mirrors octree's MIN_DIST2). Below the
// cluster scale (linkDistance≈30), so a normal layout is unaffected.
const MIN_DIST = VALUES.forceSim.minDist

const DEFAULTS: SimParams = {
  theta: VALUES.forceSim.theta,
  repulsion: VALUES.forceSim.repulsion,
  linkDistance: VALUES.forceSim.linkDistance,
  centerGravity: VALUES.forceSim.centerGravity,
  velocityDecay: VALUES.forceSim.velocityDecay,
  alphaMin: VALUES.forceSim.alphaMin,
  radialStrength: VALUES.forceSim.radialStrength,
}

// Distance floor for the radial-shell spring: below this a node is treated as "at the
// centre" with no well-defined radial direction, so the shell force is skipped (avoids a
// divide-by-zero and a random kick from the origin).
const RADIAL_MIN_DIST = 1e-3

// Spring strength multiplier applied on top of each edge's weight.
const LINK_STRENGTH = VALUES.forceSim.linkStrength

// Per-tick displacement (speed) ceiling, as a multiple of linkDistance. Hooke springs are
// LINEAR in distance, so a far or high-degree node can receive a huge one-tick kick; with
// explicit-Euler that overshoots, and on a dense/strong-spring graph the overshoot compounds
// tick-over-tick until coordinates run away to non-finite (which then makes the octree's
// bounding half-width Infinity and recurse forever — a hard crash). Clamping the per-tick step
// bounds that runaway. A settling layout moves far less than this per tick, so a normal graph
// is unaffected — this only bites the pathological stiff case (acceptance: dense universes stay
// finite and on-screen). 2×linkDistance ≈ never reached by a well-conditioned layout.
const MAX_SPEED_FACTOR = VALUES.forceSim.maxSpeedFactor

/** Opaque simulation state. Coordinates live in `px` (flat [x,y,z]); node order
 *  matches the input `nodes` array 1:1 (index = InstancedMesh instance index — the
 *  08 contract). */
export interface SimState {
  ids: string[]
  // ArrayBuffer-backed (not SharedArrayBuffer) so positions().buffer is a valid
  // transferable for the worker (TS 6.0 typed-array buffer generics).
  px: Float32Array<ArrayBuffer>
  vx: Float32Array<ArrayBuffer>
  // Per-tick external-force accumulator (repulsion + links), reused each step so a shelled
  // node can keep only the TANGENTIAL part of those forces (spec 40 — links/repulsion move a
  // star AROUND its strength-shell, never change its distance). Not transferred — internal.
  fbuf: Float32Array
  free: Uint8Array // 1 = may move, 0 = fixed
  // Per-node target shell radius (spec 38); 0 → classic centerGravity origin pull. The
  // caller may mutate entries between ticks (e.g. as a memory's strength changes on recall
  // / decay) and re-kick `alpha` to glide the node to its new shell.
  radius: Float32Array
  edges: Array<{ a: number; b: number; weight: number }> // validated, index-based
  params: SimParams
  alpha: number
  alphaDecay: number
  n: number
}

export interface CreateSimOptions {
  /** When false, a new (pinned=false) node KEEPS its caller-provided (x,y,z) instead of
   *  being reseeded to its neighbor average — used when the caller has already placed new
   *  stars near the hot cluster (spec 22, seedNearCluster). Default true (07 behavior). */
  seedNewNodes?: boolean
}

export function createSim(graph: SimGraph, params?: Partial<SimParams>, opts?: CreateSimOptions): SimState {
  const seedNewNodes = opts?.seedNewNodes ?? true
  const p: SimParams = { ...DEFAULTS, ...params }
  const nodes = graph.nodes
  const n = nodes.length

  const ids: string[] = new Array(n)
  const index = new Map<string, number>()
  const px = new Float32Array(n * 3)
  const vx = new Float32Array(n * 3)
  const fbuf = new Float32Array(n * 3) // external-force scratch (repulsion+links), zeroed per tick
  const radius = new Float32Array(n) // target shell radius per node; 0 = origin gravity
  for (let i = 0; i < n; i++) {
    const node = nodes[i]
    ids[i] = node.id
    index.set(node.id, i)
    px[i * 3] = node.x
    px[i * 3 + 1] = node.y
    px[i * 3 + 2] = node.z
    radius[i] = node.radius ?? 0
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
    if (!seedNewNodes) continue // caller placed it (seedNearCluster) — keep its coords
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
  const alphaDecay = 1 - Math.pow(p.alphaMin, 1 / VALUES.forceSim.alphaDecayTicks)

  return { ids, px, vx, fbuf, free, radius, edges, params: p, alpha: 1, alphaDecay, n }
}

/** Advance the layout by `steps` ticks IN PLACE — mutates state.px, allocates nothing. For
 *  main-thread per-frame consumers that read state.px directly (spec 37 overlay), avoiding the
 *  per-frame positions() copy (GC churn on the star-2x scene). */
export function advance(state: SimState, steps = 1): void {
  for (let s = 0; s < steps; s++) {
    if (state.alpha <= state.params.alphaMin) break // settled — stop moving (1.8)
    step(state)
    state.alpha += (0 - state.alpha) * state.alphaDecay
  }
}

/** Advance the layout by `steps` ticks; returns the current positions snapshot (a fresh copy). */
export function tick(state: SimState, steps = 1): Float32Array {
  advance(state, steps)
  return positions(state)
}

function step(state: SimState): void {
  const { px, vx, fbuf, free, radius, edges, params, n, alpha } = state
  const { theta, repulsion, linkDistance, centerGravity, velocityDecay, radialStrength } = params
  // 발산 방지 상한(틱당 변위 크기). linkDistance에 비례 — 정상 레이아웃은 훨씬 작게 움직인다.
  const maxSpeed = linkDistance * MAX_SPEED_FACTOR
  const maxSpeed2 = maxSpeed * maxSpeed

  // External forces (repulsion + links) accumulate in fbuf, kept OUT of vx so the radial-shell
  // spring below can own the distance axis (spec 40): for a shelled node (radius>0) we add only
  // the TANGENTIAL part of fbuf to vx — links/repulsion move it around its shell (angle), never
  // change |p|. Without this the link spring (coeff = weight ≈ 0.6–0.8) overpowers the shell
  // spring (radialStrength ≈ 0.1) and drags a new star out to its neighbor's shell (spec 38 gap).
  fbuf.fill(0)

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
    fbuf[i * 3] += acc.fx * alpha
    fbuf[i * 3 + 1] += acc.fy * alpha
    fbuf[i * 3 + 2] += acc.fz * alpha
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
      fbuf[ai] += dx * f
      fbuf[ai + 1] += dy * f
      fbuf[ai + 2] += dz * f
    }
    if (free[e.b]) {
      fbuf[bi] -= dx * f
      fbuf[bi + 1] -= dy * f
      fbuf[bi + 2] -= dz * f
    }
  }

  // Positioning pull + integrate (velocity damp → move). Fixed nodes never move.
  // radius>0 → external forces tangential-only + radial-shell spring owns |p|=radius so
  // distance-from-centre encodes strength (spec 38/40); radius 0 → external forces + classic
  // centerGravity origin pull (07 behavior).
  for (let i = 0; i < n; i++) {
    if (!free[i]) continue
    const xi = i * 3
    const r = radius[i]
    if (r > 0) {
      const len = Math.sqrt(px[xi] * px[xi] + px[xi + 1] * px[xi + 1] + px[xi + 2] * px[xi + 2])
      if (len > RADIAL_MIN_DIST) {
        // Unit radial r̂ = p/len. Strip the radial component of the external force, leaving the
        // tangential part (links/repulsion only swing the node AROUND its shell — spec 40 1.2).
        const ux = px[xi] / len
        const uy = px[xi + 1] / len
        const uz = px[xi + 2] / len
        const fdot = fbuf[xi] * ux + fbuf[xi + 1] * uy + fbuf[xi + 2] * uz
        vx[xi] += fbuf[xi] - fdot * ux
        vx[xi + 1] += fbuf[xi + 1] - fdot * uy
        vx[xi + 2] += fbuf[xi + 2] - fdot * uz
        // Radial-shell spring owns the distance (accumulates in vx → momentum, fast convergence).
        // f>0 pushes outward when inside the shell, inward when outside → settles at |p|=r.
        // (r−len) along the unit radial == the old px·((r−len)/len).
        const f = (r - len) * radialStrength * alpha
        vx[xi] += ux * f
        vx[xi + 1] += uy * f
        vx[xi + 2] += uz * f
      } else {
        // At the origin there's no radial direction → take the full external force (so a node
        // that drifted exactly to centre moves off it) plus a +x nudge toward its shell.
        vx[xi] += fbuf[xi] + r * radialStrength * alpha
        vx[xi + 1] += fbuf[xi + 1]
        vx[xi + 2] += fbuf[xi + 2]
      }
    } else {
      vx[xi] += fbuf[xi] - px[xi] * centerGravity * alpha
      vx[xi + 1] += fbuf[xi + 1] - px[xi + 1] * centerGravity * alpha
      vx[xi + 2] += fbuf[xi + 2] - px[xi + 2] * centerGravity * alpha
    }

    vx[xi] *= velocityDecay
    vx[xi + 1] *= velocityDecay
    vx[xi + 2] *= velocityDecay

    // 틱당 변위를 상한으로 클램프(발산 방지). 정상 레이아웃은 이 상한 아래라 무영향.
    const sp2 = vx[xi] * vx[xi] + vx[xi + 1] * vx[xi + 1] + vx[xi + 2] * vx[xi + 2]
    if (sp2 > maxSpeed2) {
      const k = maxSpeed / Math.sqrt(sp2)
      vx[xi] *= k
      vx[xi + 1] *= k
      vx[xi + 2] *= k
    }

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
