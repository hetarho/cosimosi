import { describe, expect, it } from 'vitest'
import {
  CO_RECALL_DELTA,
  createSession,
  drainDeltas,
  hasPending,
  onActiveView,
  pairKey,
} from './co-recall'

describe('co-recall session', () => {
  it('pairKey normalizes order (undirected)', () => {
    expect(pairKey('b', 'a')).toBe('a|b')
    expect(pairKey('a', 'b')).toBe('a|b')
  })

  it('a single active view records no delta', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a')
    expect(hasPending(s)).toBe(false)
  })

  it('two distinct active views add one increment to the pair (1.11/1.3)', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a')
    onActiveView(s, 'b')
    const { items, batchId } = drainDeltas(s)
    expect(batchId).toBe('batch-1')
    expect(items).toEqual([{ aId: 'a', bId: 'b', deltaWeight: CO_RECALL_DELTA }])
  })

  it('oscillating A→B→A sums the same pair twice', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a')
    onActiveView(s, 'b')
    onActiveView(s, 'a')
    const { items } = drainDeltas(s)
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({ aId: 'a', bId: 'b', deltaWeight: CO_RECALL_DELTA * 2 })
  })

  it('re-viewing the same star adds nothing (no self-pair)', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a')
    onActiveView(s, 'a')
    expect(hasPending(s)).toBe(false)
  })
})
