import { describe, expect, it } from 'vitest'
import { createSim, isSettled, positions, tick } from './sim'
import type { SimGraph, SimNode } from './types'

function node(id: string, x: number, y: number, z: number, radius?: number): SimNode {
  return { id, pinned: false, x, y, z, radius }
}

function len(buf: Float32Array, i: number): number {
  return Math.hypot(buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2])
}

function settle(state: ReturnType<typeof createSim>, cap = 3000): void {
  for (let i = 0; i < cap && !isSettled(state); i++) tick(state, 1)
}

describe('force-sim radial shell (spec 38)', () => {
  it('radius unset → classic origin gravity (07 behavior preserved) (1.7)', () => {
    // A lone free node with no radius and no edges drifts toward the origin (centerGravity).
    const graph: SimGraph = { nodes: [node('a', 40, 0, 0)], edges: [] }
    const state = createSim(graph)
    const before = len(positions(state), 0)
    settle(state)
    const after = len(positions(state), 0)
    expect(after).toBeLessThan(before) // pulled inward toward origin
    expect(after).toBeLessThan(5) // ends near the centre
  })

  it('radius set → node converges to that shell (|p| ≈ radius) (1.1)', () => {
    const graph: SimGraph = { nodes: [node('a', 3, 0, 0, 20)], edges: [] }
    const state = createSim(graph)
    settle(state)
    expect(len(positions(state), 0)).toBeCloseTo(20, 0) // settles on the radius-20 shell
  })

  it('a node stuck at the origin escapes to its shell (no radial direction → nudge)', () => {
    const graph: SimGraph = { nodes: [node('a', 0, 0, 0, 20)], edges: [] }
    const state = createSim(graph)
    settle(state)
    expect(len(positions(state), 0)).toBeCloseTo(20, 0) // escaped origin, reached the shell
  })

  it('a node OUTSIDE its shell is pulled inward to it', () => {
    const graph: SimGraph = { nodes: [node('a', 90, 0, 0, 25)], edges: [] }
    const state = createSim(graph)
    settle(state)
    expect(len(positions(state), 0)).toBeCloseTo(25, 0)
  })

  it('same-radius nodes spread angularly on the shell, not into a chain (1.6)', () => {
    // Four nodes share radius 20; with no edges, repulsion distributes them on the shell.
    const graph: SimGraph = {
      nodes: [
        node('a', 18, 1, 0, 20),
        node('b', 17, -2, 1, 20),
        node('c', 19, 0, 2, 20),
        node('d', 16, 2, -1, 20),
      ],
      edges: [],
    }
    const state = createSim(graph)
    settle(state)
    const buf = positions(state)
    // All four settle at (roughly) the SAME radius — a shell, not a chain. Repulsion
    // inflates the equilibrium a bit beyond the 20 target, so assert consistency (every
    // radius within ±25% of the mean) rather than the exact target.
    const radii = [0, 1, 2, 3].map((i) => len(buf, i))
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length
    expect(mean).toBeGreaterThan(15) // near the radius-20 shell (repulsion inflates it)
    for (const r of radii) expect(Math.abs(r - mean) / mean).toBeLessThan(0.25)
    // and they don't collapse together — every pair is meaningfully separated.
    let minPair = Infinity
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const d = Math.hypot(
          buf[i * 3] - buf[j * 3],
          buf[i * 3 + 1] - buf[j * 3 + 1],
          buf[i * 3 + 2] - buf[j * 3 + 2],
        )
        minPair = Math.min(minPair, d)
      }
    }
    expect(minPair).toBeGreaterThan(5) // angular spread on the shell
  })

  it('a shelled node linked to a far-out neighbor holds its shell, not dragged out (spec 40, 1.1/1.2)', () => {
    // The spec-38 gap: a fresh star (small strength-radius) linked to an OLD, far-out star
    // (large radius) got dragged toward it by the link spring — settling near `Rn − linkDistance`
    // (~24 for a neighbor at 40) instead of its own R_MIN shell. spec 40 makes links tangential,
    // so the link only swings the new star AROUND its shell; the radial-shell spring keeps |p|≈6.
    const graph: SimGraph = {
      nodes: [
        { id: 'far', pinned: true, x: 40, y: 0, z: 0 }, // old neighbor, fixed far out
        { id: 'new', pinned: false, x: 6, y: 1, z: 0, radius: 6 }, // fresh star, near-centre shell
      ],
      edges: [{ source: 'far', target: 'new', weight: 0.7 }], // a strong-ish semantic link
    }
    const state = createSim(graph, undefined, { seedNewNodes: false })
    // createSim frees a pinned node's 1-hop neighbors; hard-pin 'far' (free=0) so it truly stays
    // at radius 40 — otherwise it (no radius → origin gravity) drifts inward and the test could
    // pass without proving the link no longer drags 'new' out.
    state.free[state.ids.indexOf('far')] = 0
    settle(state)
    const i = state.ids.indexOf('new')
    expect(len(positions(state), 0)).toBeCloseTo(40, 0) // 'far' stayed fixed far out…
    expect(len(positions(state), i)).toBeCloseTo(6, 0) // …and 'new' holds its strength-shell…
    expect(len(positions(state), i)).toBeLessThan(12) // …not dragged out toward the neighbor (~24)
  })

  it('the radius target can be mutated between ticks → node glides to the new shell', () => {
    const state = createSim({ nodes: [node('a', 3, 0, 0, 15)], edges: [] })
    settle(state)
    expect(len(positions(state), 0)).toBeCloseTo(15, 0)
    // Recall/decay would change strength → new target radius; bump alpha to re-relax.
    state.radius[0] = 45
    state.alpha = 1
    settle(state)
    expect(len(positions(state), 0)).toBeCloseTo(45, 0)
  })
})
