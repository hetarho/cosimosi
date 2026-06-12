import { describe, expect, it } from 'vitest'
import type { SynapseEdge } from '@/entities/synapse/@x/memory'
import { HALF_LIFE_DAYS, starBrightness } from './activation'
import { mergeEdges, mergeStars } from './merge'
import type { StarNode } from './types'

const NOW = 1_700_000_000_000
const DAY_MS = 86_400_000

function star(id: string, index: number, lastRecalledAt = NOW): StarNode {
  return {
    id,
    index,
    memory: { id, mood: 'joy', intensity: 0.5, valence: 0, lastRecalledAt, seed: index * 0.1 },
  }
}

function edge(aId: string, bId: string, over: Partial<SynapseEdge> = {}): SynapseEdge {
  return {
    aId,
    bId,
    weight: 0.5,
    brightness: 0.8,
    reinforcedRecency: 0,
    linkType: 'semantic',
    ...over,
  }
}

describe('mergeStars (spec 16, 1.4)', () => {
  it('preserves existing StarNode object identity when nothing changed (slot/seed/pin)', () => {
    const local = [star('a', 0), star('b', 1)]
    const merged = mergeStars(local, [star('a', 99), star('b', 99)])
    expect(merged).toBe(local) // no-op → same reference, no re-render
  })

  it('appends server-only new stars at the end with the next free slots', () => {
    const local = [star('a', 0), star('b', 1)]
    const merged = mergeStars(local, [star('a', 0), star('c', 0), star('d', 1)])
    expect(merged.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(merged.map((s) => s.index)).toEqual([0, 1, 2, 3])
    expect(merged[0]).toBe(local[0]) // existing objects untouched
    expect(merged[1]).toBe(local[1])
  })

  it('advances lastRecalledAt to max(server, local) keeping index/seed', () => {
    const local = [star('a', 0, NOW - 1000)]
    const merged = mergeStars(local, [star('a', 7, NOW)])
    expect(merged[0].memory.lastRecalledAt).toBe(NOW)
    expect(merged[0].index).toBe(0) // slot kept, server's mapping index ignored
    expect(merged[0].memory.seed).toBe(local[0].memory.seed)
  })

  it('keeps a locally-ahead lastRecalledAt (my recall can outrun the response)', () => {
    const local = [star('a', 0, NOW)]
    const merged = mergeStars(local, [star('a', 0, NOW - 5000)])
    expect(merged).toBe(local)
    expect(merged[0].memory.lastRecalledAt).toBe(NOW)
  })

  it('never drops local-only stars: temp stars and mid-refetch confirmed stars survive', () => {
    const temp = star('temp-123', 2)
    const confirmed = star('just-saved', 3)
    const local = [star('a', 0), star('b', 1), temp, confirmed]
    const merged = mergeStars(local, [star('a', 0), star('b', 1)]) // stale response without them
    expect(merged).toBe(local)
    expect(merged).toContain(temp) // untouched — replaceStar owns the temp swap
    expect(merged).toContain(confirmed)
  })

  it('keeps array order local-stable regardless of server response order', () => {
    const local = [star('a', 0), star('b', 1)]
    const merged = mergeStars(local, [star('b', 0), star('a', 1), star('c', 2)])
    expect(merged.map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('mergeEdges (spec 16, 1.4/1.8)', () => {
  it('returns the same reference when nothing changed', () => {
    const local = [edge('a', 'b'), edge('b', 'c')]
    const merged = mergeEdges(local, [edge('a', 'b'), edge('b', 'c')], NOW)
    expect(merged).toBe(local)
  })

  it('takes max(server, local) for weight — no visual thinning with un-flushed deltas', () => {
    const local = [edge('a', 'b', { weight: 0.7 })] // locally reinforced, not yet flushed
    const merged = mergeEdges(local, [edge('a', 'b', { weight: 0.6 })], NOW) // server is behind
    expect(merged[0].weight).toBe(0.7)
    const merged2 = mergeEdges(local, [edge('a', 'b', { weight: 0.9 })], NOW) // server is ahead
    expect(merged2[0].weight).toBe(0.9)
  })

  it('falls back to max for brightness without timestamps, max for reinforcedRecency', () => {
    const local = [edge('a', 'b', { brightness: 0.9, reinforcedRecency: 0.8 })]
    const merged = mergeEdges(local, [edge('a', 'b', { brightness: 0.5, reinforcedRecency: 0 })], NOW)
    expect(merged[0]).toBe(local[0]) // local ahead on every field → identity kept
    const merged2 = mergeEdges(local, [edge('a', 'b', { brightness: 1.0 })], NOW)
    expect(merged2[0].brightness).toBe(1.0)
    expect(merged2[0].reinforcedRecency).toBe(0.8) // local pulse state survives the refetch
  })

  it('re-derives brightness from max(lastActivatedAt) at now — decay progresses on refetch', () => {
    const ts = NOW - HALF_LIFE_DAYS * DAY_MS // activation ≈ 0.5 at NOW
    // local brightness was baked a half-life ago (≈1.0); a naive max() would keep it.
    const local = [edge('a', 'b', { brightness: 1.0, lastActivatedAt: ts })]
    const merged = mergeEdges(
      local,
      [edge('a', 'b', { brightness: starBrightness(ts, NOW), lastActivatedAt: ts })],
      NOW,
    )
    expect(merged[0].brightness).toBeCloseTo(starBrightness(ts, NOW), 10) // ≈0.5, not 1.0
  })

  it('server reactivation advances lastActivatedAt and re-brightens', () => {
    const old = NOW - HALF_LIFE_DAYS * DAY_MS
    const local = [edge('a', 'b', { brightness: 0.5, lastActivatedAt: old })]
    const merged = mergeEdges(local, [edge('a', 'b', { lastActivatedAt: NOW })], NOW)
    expect(merged[0].lastActivatedAt).toBe(NOW)
    expect(merged[0].brightness).toBeCloseTo(1.0, 10)
  })

  it('appends server-only edges and keeps local-only edges (no deletion)', () => {
    const local = [edge('a', 'b')]
    const merged = mergeEdges(local, [edge('c', 'd')], NOW)
    expect(merged.map((e) => `${e.aId}|${e.bId}`)).toEqual(['a|b', 'c|d'])
    expect(merged[0]).toBe(local[0])
  })

  it('matches pairs regardless of endpoint order (undirected key)', () => {
    const local = [edge('a', 'b', { weight: 0.4 })]
    const merged = mergeEdges(local, [edge('b', 'a', { weight: 0.6 })], NOW)
    expect(merged).toHaveLength(1)
    expect(merged[0].weight).toBe(0.6)
  })
})
