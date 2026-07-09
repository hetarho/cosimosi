import { describe, expect, it } from 'vitest'

import { pickAwakenSeeds, recentlyActiveNeuronIds, type AwakenAnchor } from './pick-awaken-seed.ts'

// A tiny 4-point field on the x-axis: indices 0..3 at x = 0,10,20,30.
const FIELD = new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0, 30, 0, 0])
const COUNT = 4

function seededRandom(sequence: readonly number[]): () => number {
  let i = 0
  return () => sequence[i++ % sequence.length] ?? 0
}

describe('recentlyActiveNeuronIds', () => {
  const memories = [
    {
      createdUniverseTime: '2026-01-10',
      lastRecalledUniverseTime: null,
      activations: [{ neuronId: 'recent' }],
    },
    {
      createdUniverseTime: '2025-06-01',
      lastRecalledUniverseTime: null,
      activations: [{ neuronId: 'old' }],
    },
    {
      createdUniverseTime: '2025-01-01',
      lastRecalledUniverseTime: '2026-01-09',
      activations: [{ neuronId: 'recalled' }],
    },
  ]

  it('returns neurons of memories created/recalled inside the window, dropping stale ones', () => {
    const ids = recentlyActiveNeuronIds({ memories, universeTime: '2026-01-11', windowDays: 3 })
    expect([...ids].sort()).toEqual(['recalled', 'recent'])
  })

  it('honors excludeIds (the just-born neurons are not their own anchor)', () => {
    const ids = recentlyActiveNeuronIds({
      memories,
      universeTime: '2026-01-11',
      windowDays: 3,
      excludeIds: new Set(['recent']),
    })
    expect([...ids]).toEqual(['recalled'])
  })

  it('returns nothing when there is no universe time', () => {
    expect(recentlyActiveNeuronIds({ memories, universeTime: null, windowDays: 3 })).toEqual([])
  })
})

describe('pickAwakenSeeds', () => {
  const noRandom = () => 0

  it('picks the latent point nearest an anchor', () => {
    const anchors: AwakenAnchor[] = [[19, 0, 0]] // closest to index 2 (x=20)
    const picks = pickAwakenSeeds({
      positions: FIELD,
      count: COUNT,
      consumed: new Set(),
      anchors,
      births: 1,
      random: noRandom,
    })
    expect(picks).toEqual([2])
  })

  it('falls back to a random point when there is no recent cue', () => {
    // random 0.5 * 4 available → floor 2 → the 3rd available index (2).
    const picks = pickAwakenSeeds({
      positions: FIELD,
      count: COUNT,
      consumed: new Set(),
      anchors: [],
      births: 1,
      random: seededRandom([0.5]),
    })
    expect(picks).toEqual([2])
  })

  it('gives N simultaneous births N distinct latent points', () => {
    const anchors: AwakenAnchor[] = [[0, 0, 0]]
    const picks = pickAwakenSeeds({
      positions: FIELD,
      count: COUNT,
      consumed: new Set(),
      anchors,
      births: 3,
      random: noRandom,
    })
    expect(new Set(picks).size).toBe(3)
    expect(picks).toEqual([0, 1, 2]) // nearest-first from anchor at origin
  })

  it('never re-picks a consumed point', () => {
    const anchors: AwakenAnchor[] = [[0, 0, 0]]
    const picks = pickAwakenSeeds({
      positions: FIELD,
      count: COUNT,
      consumed: new Set([0, 1]),
      anchors,
      births: 2,
      random: noRandom,
    })
    expect(picks).toEqual([2, 3])
  })

  it('returns fewer picks than births when the field is exhausted', () => {
    const picks = pickAwakenSeeds({
      positions: FIELD,
      count: COUNT,
      consumed: new Set([0, 1, 2]),
      anchors: [],
      births: 3,
      random: seededRandom([0, 0, 0]),
    })
    expect(picks).toEqual([3])
  })
})
