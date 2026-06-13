import { describe, expect, it } from 'vitest'
import { seedNearCluster } from './seed'
import { createSim, positions, tick } from './sim'
import type { SimGraph } from './types'

describe('seedNearCluster', () => {
  const positionOf = (id: string): [number, number, number] | null => {
    if (id === 'hot') return [100, 0, 0]
    if (id === 'cold') return [-100, 0, 0]
    return null
  }

  it('biases the seed toward the hottest neighbor (1.6)', () => {
    const seeded = seedNearCluster(
      'new',
      [
        { id: 'hot', heat: 1.0 },
        { id: 'cold', heat: 0.0 },
      ],
      positionOf,
      [0, 0, 0],
    )
    // Hot neighbor at +100, cold at -100 → weighted blend lands on the +x (hot) side.
    expect(seeded[0]).toBeGreaterThan(0)
  })

  it('falls back to the provided shell seed when no neighbor is placed', () => {
    const fb: [number, number, number] = [7, 8, 9]
    const seeded = seedNearCluster('orphan', [{ id: 'unknown', heat: 1 }], positionOf, fb)
    // Within the jitter radius (~±1.5) of the fallback.
    expect(Math.abs(seeded[0] - fb[0])).toBeLessThan(2)
    expect(Math.abs(seeded[1] - fb[1])).toBeLessThan(2)
    expect(Math.abs(seeded[2] - fb[2])).toBeLessThan(2)
  })

  it('is deterministic for the same id', () => {
    const a = seedNearCluster('new', [{ id: 'hot', heat: 1 }], positionOf, [0, 0, 0])
    const b = seedNearCluster('new', [{ id: 'hot', heat: 1 }], positionOf, [0, 0, 0])
    expect(a).toEqual(b)
  })
})

describe('createSim seedNewNodes option', () => {
  it('keeps caller-provided coords for new nodes when false', () => {
    const graph: SimGraph = {
      nodes: [
        { id: 'p', pinned: true, x: 0, y: 0, z: 0 },
        { id: 'n', pinned: false, x: 50, y: 50, z: 50 }, // pre-seeded by seedNearCluster
      ],
      edges: [{ source: 'p', target: 'n', weight: 1 }],
    }
    const state = createSim(graph, undefined, { seedNewNodes: false })
    const buf = positions(state)
    // The new node starts at its given coords, not reseeded to the neighbor (0,0,0).
    expect(buf[3]).toBe(50)
    expect(buf[4]).toBe(50)
    expect(buf[5]).toBe(50)
  })

  it('reseeds new nodes to neighbor average by default (07 behavior)', () => {
    const graph: SimGraph = {
      nodes: [
        { id: 'p', pinned: true, x: 0, y: 0, z: 0 },
        { id: 'n', pinned: false, x: 50, y: 50, z: 50 },
      ],
      edges: [{ source: 'p', target: 'n', weight: 1 }],
    }
    const state = createSim(graph)
    const buf = positions(state)
    // Reseeded near the neighbor (0,0,0) ± small jitter — far from the given (50,50,50).
    expect(Math.abs(buf[3])).toBeLessThan(5)
    // And it still moves under the spring.
    const moved = tick(state, 50)
    expect(Number.isFinite(moved[3])).toBe(true)
  })
})
