import { describe, expect, it } from 'vitest'
import { VALUES } from '@/shared/config'
import {
  CO_RECALL_DELTA,
  createSession,
  drainDeltas,
  hasPending,
  onActiveView,
  pairKey,
} from './co-recall'

describe('co-recall session (change 22 — no spacing effect)', () => {
  it('pairKey normalizes order (undirected)', () => {
    expect(pairKey('b', 'a')).toBe('a|b')
    expect(pairKey('a', 'b')).toBe('a|b')
  })

  it('a single active view records no delta', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a')
    expect(hasPending(s)).toBe(false)
  })

  it('two distinct active views add one fixed increment to the pair', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a')
    onActiveView(s, 'b')
    const { items, batchId } = drainDeltas(s)
    expect(batchId).toBe('batch-1')
    expect(items).toEqual([{ aId: 'a', bId: 'b', deltaWeight: CO_RECALL_DELTA }])
  })

  it('oscillating A→B→A sums the same pair twice — interval-independent (A1: 몰아보기 1× = 하루 띄움 1×)', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a')
    onActiveView(s, 'b')
    onActiveView(s, 'a')
    const { items } = drainDeltas(s)
    expect(items).toHaveLength(1)
    // Always exactly 2× the base delta — onActiveView takes no time input, so a gap can't change it.
    expect(items[0]).toEqual({ aId: 'a', bId: 'b', deltaWeight: CO_RECALL_DELTA * 2 })
  })

  it('re-viewing the same star adds nothing (no self-pair)', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a')
    onActiveView(s, 'a')
    expect(hasPending(s)).toBe(false)
  })

  it('dwell gate retired — recall is the deliberate button now (change 35)', () => {
    expect('dwellMs' in VALUES.recall).toBe(false)
  })

  it('spacing knobs removed from values (A2)', () => {
    expect('spacingGain' in VALUES.recall).toBe(false)
    expect('spacingRefDays' in VALUES.recall).toBe(false)
  })
})
