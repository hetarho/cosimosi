import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { groupLedgerByDay, todayRefillMarker } from './ledger-day.ts'

const entry = (id: string, occurredOn: string) => ({ id, occurredOn })

describe('ledger day grouping', () => {
  it('segments by the server-resolved date without reordering anything', () => {
    const grouped = groupLedgerByDay([
      entry('e5', '2026-07-15'),
      entry('e4', '2026-07-15'),
      entry('e3', '2026-07-14'),
      entry('e1', '2026-07-12'),
    ])

    expect(grouped.map((day) => day.occurredOn)).toEqual(['2026-07-15', '2026-07-14', '2026-07-12'])
    expect(grouped[0]?.entries.map((row) => row.id)).toEqual(['e5', 'e4'])
    expect(grouped[1]?.entries.map((row) => row.id)).toEqual(['e3'])
  })

  it('starts a new day for a repeated date rather than merging it back', () => {
    // The keyset already decided the order; grouping must not re-sort it. A repeated date after a gap
    // therefore reads as two groups — visible, rather than silently interleaved into the earlier one.
    const grouped = groupLedgerByDay([
      entry('a', '2026-07-15'),
      entry('b', '2026-07-14'),
      entry('c', '2026-07-15'),
    ])

    expect(grouped.map((day) => day.occurredOn)).toEqual(['2026-07-15', '2026-07-14', '2026-07-15'])
  })

  it('groups nothing into nothing', () => {
    expect(groupLedgerByDay([])).toEqual([])
  })

  it('states the refill as a granted amount and nothing else', () => {
    const marker = todayRefillMarker()

    expect(marker.amount).toBe(VALUES.twinkle.smallDailyAmount)
    // [G7]: no reason, no entry id, no date — a marker cannot be produced from a row or mistaken for
    // one, and it invents no client-side notion of the user's today.
    expect(Object.keys(marker)).toEqual(['amount'])
  })
})
