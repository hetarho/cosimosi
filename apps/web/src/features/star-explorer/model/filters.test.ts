import { describe, expect, it } from 'vitest'
import { filterStars, type StarFilterEntry } from './filters'

const stars: StarFilterEntry[] = [
  { memoryId: 'm1', mood: 'joy', entryDate: '2026-01-10', lastRecalledAt: 100, dormant: false },
  { memoryId: 'm2', mood: 'fear', entryDate: '2026-03-05', lastRecalledAt: 200, dormant: true },
  { memoryId: 'm3', mood: 'calm', entryDate: undefined, lastRecalledAt: 300, dormant: true },
]

describe('filterStars', () => {
  it('returns all awake + dormant with dormancy=all', () => {
    expect(filterStars(stars, { query: '', moods: [], dormancy: 'all' })).toHaveLength(3)
  })

  it('filters by dormancy state', () => {
    expect(
      filterStars(stars, { query: '', moods: [], dormancy: 'dormant' }).map((s) => s.memoryId),
    ).toEqual(['m2', 'm3'])
    expect(
      filterStars(stars, { query: '', moods: [], dormancy: 'awake' }).map((s) => s.memoryId),
    ).toEqual(['m1'])
  })

  it('filters by emotion facet', () => {
    expect(
      filterStars(stars, { query: '', moods: ['joy', 'calm'], dormancy: 'all' }).map((s) => s.memoryId),
    ).toEqual(['m1', 'm3'])
  })

  it('matches mood label / id in free text', () => {
    expect(filterStars(stars, { query: '평온', moods: [], dormancy: 'all' }).map((s) => s.memoryId)).toEqual([
      'm3',
    ])
    expect(filterStars(stars, { query: 'm2', moods: [], dormancy: 'all' }).map((s) => s.memoryId)).toEqual([
      'm2',
    ])
  })

  it('excludes date-less stars when a date range is set', () => {
    expect(
      filterStars(stars, { query: '', moods: [], dormancy: 'all', from: '2026-01-01', to: '2026-12-31' }).map(
        (s) => s.memoryId,
      ),
    ).toEqual(['m1', 'm2']) // m3 has no entryDate → excluded by an active range
  })
})
