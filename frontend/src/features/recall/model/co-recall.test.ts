import { describe, expect, it } from 'vitest'
import {
  CO_RECALL_DELTA,
  createSession,
  drainDeltas,
  hasPending,
  onActiveView,
  pairKey,
  spacingBoost,
  SPACING_GAIN,
  SPACING_REF_DAYS,
} from './co-recall'

const T0 = 1_000_000_000_000 // fixed virtual now for deterministic spacing
const DAY = 86_400_000

describe('co-recall session', () => {
  it('pairKey normalizes order (undirected)', () => {
    expect(pairKey('b', 'a')).toBe('a|b')
    expect(pairKey('a', 'b')).toBe('a|b')
  })

  it('a single active view records no delta', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a', T0)
    expect(hasPending(s)).toBe(false)
  })

  it('two distinct active views add one increment to the pair (1.11/1.3)', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a', T0)
    onActiveView(s, 'b', T0)
    const { items, batchId } = drainDeltas(s)
    expect(batchId).toBe('batch-1')
    // First-ever co-recall of the pair (no prior gap) → base increment (boost 1×).
    expect(items).toEqual([{ aId: 'a', bId: 'b', deltaWeight: CO_RECALL_DELTA }])
  })

  it('oscillating A→B→A in one session sums the same pair twice (no spacing)', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a', T0)
    onActiveView(s, 'b', T0)
    onActiveView(s, 'a', T0)
    const { items } = drainDeltas(s)
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({ aId: 'a', bId: 'b', deltaWeight: CO_RECALL_DELTA * 2 })
  })

  it('re-viewing the same star adds nothing (no self-pair)', () => {
    const s = createSession('batch-1')
    onActiveView(s, 'a', T0)
    onActiveView(s, 'a', T0)
    expect(hasPending(s)).toBe(false)
  })
})

describe('spacing effect (spec 23, Katz 2021)', () => {
  it('spacingBoost rises from 1× (massed) to 1+gain (spaced)', () => {
    expect(spacingBoost(0)).toBe(1)
    expect(spacingBoost(SPACING_REF_DAYS)).toBe(1 + SPACING_GAIN)
    expect(spacingBoost(SPACING_REF_DAYS * 10)).toBe(1 + SPACING_GAIN) // clamped
    expect(spacingBoost(-5)).toBe(1) // clamped
  })

  it('a pair re-viewed after a gap gains a BIGGER increment than massed (2.1)', () => {
    // Massed: A↔B twice within the same instant.
    const massed = createSession('m')
    onActiveView(massed, 'a', T0)
    onActiveView(massed, 'b', T0)
    onActiveView(massed, 'a', T0)
    const massedDelta = drainDeltas(massed).items[0].deltaWeight

    // Spaced: the second A↔B co-recall happens a full reference day later.
    const spaced = createSession('s')
    onActiveView(spaced, 'a', T0)
    onActiveView(spaced, 'b', T0)
    onActiveView(spaced, 'a', T0 + SPACING_REF_DAYS * DAY)
    const spacedDelta = drainDeltas(spaced).items[0].deltaWeight

    expect(spacedDelta).toBeGreaterThan(massedDelta)
  })
})
