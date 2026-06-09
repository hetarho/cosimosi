import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/shared/lib/prng'
import { alpha, createSim, isSettled, positions, tick } from './sim'
import type { SimGraph, SimNode } from './types'

function node(id: string, pinned: boolean, x = 0, y = 0, z = 0): SimNode {
  return { id, pinned, x, y, z }
}

function dist(buf: Float32Array, i: number, j: number): number {
  const dx = buf[i * 3] - buf[j * 3]
  const dy = buf[i * 3 + 1] - buf[j * 3 + 1]
  const dz = buf[i * 3 + 2] - buf[j * 3 + 2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Run until settled (or a hard cap). */
function settle(state: ReturnType<typeof createSim>, cap = 2000): void {
  for (let i = 0; i < cap && !isSettled(state); i++) tick(state, 1)
}

describe('force-sim', () => {
  it('converges strong-weight pairs closer than weak ones (1.1)', () => {
    // Two well-separated pairs (no pins): pair A-B is strong, C-D is weak. Cross-pair
    // repulsion is negligible at this separation; within each pair the spring (scaled
    // by weight) balances the mutual repulsion, so the strong pair rests closer.
    const graph: SimGraph = {
      nodes: [
        node('a', false, 0, 0, 0),
        node('b', false, 40, 0, 0),
        node('c', false, 1000, 0, 0),
        node('d', false, 1040, 0, 0),
      ],
      edges: [
        { source: 'a', target: 'b', weight: 1.0 },
        { source: 'c', target: 'd', weight: 0.1 },
      ],
    }
    const state = createSim(graph)
    settle(state)
    const buf = positions(state)
    const strong = dist(buf, 0, 1)
    const weak = dist(buf, 2, 3)
    expect(strong).toBeLessThan(weak)
  })

  it('keeps pinned nodes fixed (1.2)', () => {
    const graph: SimGraph = {
      nodes: [node('p1', true, 10, 5, -3), node('p2', true, -10, 2, 7)],
      edges: [{ source: 'p1', target: 'p2', weight: 1.0 }],
    }
    const state = createSim(graph)
    const before = positions(state)
    tick(state, 100)
    const after = positions(state)
    for (let i = 0; i < before.length; i++) {
      expect(Math.abs(after[i] - before[i])).toBeLessThanOrEqual(1e-6)
    }
  })

  // 1.3 — only the new node and its 1-hop neighbors move; everything else is fixed.
  it('moves only new node + 1-hop neighbors (1.3)', () => {
    const graph: SimGraph = {
      nodes: [
        node('p1', true, 0, 0, 0), // 1-hop neighbor of x → free
        node('p2', true, 50, 0, 0), // not connected to x → fixed
        node('p3', true, 0, 50, 0), // not connected to x → fixed
        node('x', false, 5, 5, 5), // new → free
      ],
      edges: [
        { source: 'x', target: 'p1', weight: 1.0 },
        { source: 'p2', target: 'p3', weight: 1.0 }, // both pinned, no new node → fixed
      ],
    }
    const state = createSim(graph)
    const before = positions(state)
    tick(state, 80)
    const after = positions(state)

    // p2, p3 (indices 1, 2): unchanged (1-hop OUTSIDE → fixed).
    for (const idx of [1, 2]) {
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(after[idx * 3 + k] - before[idx * 3 + k])).toBeLessThanOrEqual(1e-6)
      }
    }
    const moved = (idx: number): number => {
      let d = 0
      for (let k = 0; k < 3; k++) d += Math.abs(after[idx * 3 + k] - before[idx * 3 + k])
      return d
    }
    // x (index 3, new) moved AND p1 (index 0, the 1-hop pinned neighbor) moved — both
    // halves of acceptance 1.3 ("the new node AND its 1-hop neighbors change").
    expect(moved(3)).toBeGreaterThan(1e-6)
    expect(moved(0)).toBeGreaterThan(1e-6)
  })

  it('returns positions of length n*3 in input order (1.4)', () => {
    const graph: SimGraph = {
      nodes: [node('a', true, 1, 2, 3), node('b', true, 4, 5, 6), node('c', true, 7, 8, 9)],
      edges: [],
    }
    const state = createSim(graph)
    const buf = positions(state)
    expect(buf).toBeInstanceOf(Float32Array)
    expect(buf.length).toBe(9)
    // pinned input coords preserved in order
    expect(Array.from(buf)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('ignores edges with unknown endpoints (1.7)', () => {
    const graph: SimGraph = {
      nodes: [node('a', false, 0, 0, 0), node('b', false, 10, 0, 0)],
      edges: [
        { source: 'a', target: 'b', weight: 1.0 },
        { source: 'a', target: 'ghost', weight: 1.0 }, // unknown target
        { source: 'nobody', target: 'b', weight: 1.0 }, // unknown source
      ],
    }
    expect(() => {
      const state = createSim(graph)
      tick(state, 10)
    }).not.toThrow()
  })

  // 1.5 — N=3000 octree path completes a tick without freezing or producing NaN.
  it('handles N=3000 in one tick (octree path) (1.5)', () => {
    const n = 3000
    const rng = mulberry32(12345)
    const nodes: SimNode[] = []
    for (let i = 0; i < n; i++) {
      nodes.push(node(`n${i}`, false, (rng() - 0.5) * 500, (rng() - 0.5) * 500, (rng() - 0.5) * 500))
    }
    const edges = []
    for (let i = 1; i < n; i++) edges.push({ source: `n${i}`, target: `n${i - 1}`, weight: rng() })
    const graph: SimGraph = { nodes, edges }

    const t0 = performance.now()
    const state = createSim(graph)
    const buf = tick(state, 1)
    const elapsed = performance.now() - t0

    expect(buf.length).toBe(n * 3)
    for (let i = 0; i < buf.length; i++) expect(Number.isFinite(buf[i])).toBe(true)
    // Loose guard: an O(N log N) tick is milliseconds; only catches catastrophic regressions.
    expect(elapsed).toBeLessThan(3000)
    expect(typeof alpha(state)).toBe('number')
  })
})
