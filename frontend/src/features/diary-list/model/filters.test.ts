import { describe, expect, it } from 'vitest'
import { filterDiaries, type DiaryFilterEntry } from './filters'

const entries: DiaryFilterEntry[] = [
  { recordId: 'r1', entryDate: '2026-01-10', bodyExcerpt: '눈 오는 아침', moods: ['joy', 'calm'] },
  { recordId: 'r2', entryDate: '2026-03-05', bodyExcerpt: '시험 전날 불안', moods: ['fear'] },
  { recordId: 'r3', entryDate: '2026-06-19', bodyExcerpt: '바다에서', moods: [] },
]

describe('filterDiaries', () => {
  it('returns all with an empty filter', () => {
    expect(filterDiaries(entries, { query: '', moods: [] })).toHaveLength(3)
  })

  it('matches body excerpt, date, and mood label in free text', () => {
    expect(filterDiaries(entries, { query: '바다', moods: [] }).map((e) => e.recordId)).toEqual(['r3'])
    expect(filterDiaries(entries, { query: '2026-03', moods: [] }).map((e) => e.recordId)).toEqual(['r2'])
    expect(filterDiaries(entries, { query: '두려움', moods: [] }).map((e) => e.recordId)).toEqual(['r2'])
  })

  it('filters by emotion facet (ANY selected mood present)', () => {
    expect(filterDiaries(entries, { query: '', moods: ['calm'] }).map((e) => e.recordId)).toEqual(['r1'])
    expect(filterDiaries(entries, { query: '', moods: ['joy', 'fear'] }).map((e) => e.recordId)).toEqual([
      'r1',
      'r2',
    ])
  })

  it('filters by inclusive date range', () => {
    expect(
      filterDiaries(entries, { query: '', moods: [], from: '2026-02-01', to: '2026-06-30' }).map(
        (e) => e.recordId,
      ),
    ).toEqual(['r2', 'r3'])
    expect(
      filterDiaries(entries, { query: '', moods: [], from: '2026-06-19', to: '2026-06-19' }).map(
        (e) => e.recordId,
      ),
    ).toEqual(['r3'])
  })

  it('combines text + mood + date (AND)', () => {
    expect(
      filterDiaries(entries, { query: '아침', moods: ['joy'], from: '2026-01-01', to: '2026-12-31' }).map(
        (e) => e.recordId,
      ),
    ).toEqual(['r1'])
    expect(filterDiaries(entries, { query: '아침', moods: ['fear'] })).toHaveLength(0)
  })
})
