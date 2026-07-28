import { describe, expect, it } from 'vitest'

import { DiarySort } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'

import {
  diaryQueryFromSearch,
  diarySearchFromQuery,
  parseDiarySearch,
  searchWithUpdate,
} from './diary-search.ts'

describe('parseDiarySearch', () => {
  it('drops a keyword the archive read would refuse, so a hand-shortened link still shows the archive', () => {
    expect(parseDiarySearch({ q: 'a' }).q).toBeUndefined()
    expect(parseDiarySearch({ q: '  a  ' }).q).toBeUndefined()
    expect(parseDiarySearch({ q: '커피' }).q).toBe('커피')
    expect(VALUES.diaryReader.searchMinQueryLength).toBeGreaterThan(1)
  })

  it('keeps only the moods the palette knows, once each, in declaration order', () => {
    expect(parseDiarySearch({ moods: ['SAD', 'NOPE', 'JOY', 'SAD'] }).moods).toEqual(['JOY', 'SAD'])
    expect(parseDiarySearch({ moods: 'JOY' }).moods).toEqual(['JOY'])
    expect(parseDiarySearch({ moods: ['NOPE'] }).moods).toBeUndefined()
  })

  it('drops a date that is not a full ISO day', () => {
    expect(parseDiarySearch({ from: '2026-01-31' }).from).toBe('2026-01-31')
    expect(parseDiarySearch({ from: '2026-01' }).from).toBeUndefined()
    expect(parseDiarySearch({ to: 'yesterday' }).to).toBeUndefined()
  })

  it('collapses an unknown sort to the default rather than refusing the read', () => {
    expect(parseDiarySearch({ sort: 'sideways' }).sort).toBeUndefined()
    expect(parseDiarySearch({ sort: 'oldest' }).sort).toBe('oldest')
  })

  it('keeps `view=calendar` and drops every other value, so a bare /diary stays bare ([D12])', () => {
    expect(parseDiarySearch({ view: 'calendar' }).view).toBe('calendar')
    expect(parseDiarySearch({ view: 'list' }).view).toBeUndefined()
    expect(parseDiarySearch({ view: 'sideways' }).view).toBeUndefined()
  })

  it('accepts only a well-formed YYYY-MM month', () => {
    expect(parseDiarySearch({ month: '2026-05' }).month).toBe('2026-05')
    expect(parseDiarySearch({ month: '2026-13' }).month).toBeUndefined()
    expect(parseDiarySearch({ month: '2026-00' }).month).toBeUndefined()
    expect(parseDiarySearch({ month: '2026-5' }).month).toBeUndefined()
    expect(parseDiarySearch({ month: '2026-05-01' }).month).toBeUndefined()
  })
})

describe('view state stays out of the conditions mappers ([D12])', () => {
  it('carries neither view nor month into the archive read input', () => {
    const input = diaryQueryFromSearch({ view: 'calendar', month: '2026-05' })
    expect(Object.keys(input).sort()).toEqual(['from', 'moods', 'query', 'sort', 'to'])
  })

  it('reconstructs neither view nor month from the read input', () => {
    const params = diarySearchFromQuery({ from: '2026-05-04', to: '2026-05-04' })
    expect(params.view).toBeUndefined()
    expect(params.month).toBeUndefined()
  })
})

describe('diaryQueryFromSearch / diarySearchFromQuery', () => {
  it('defaults to the newest-first archive', () => {
    expect(diaryQueryFromSearch({}).sort).toBe(DiarySort.NEWEST)
  })

  it('leaves an unconditioned archive at a bare /diary', () => {
    expect(diarySearchFromQuery(diaryQueryFromSearch({}))).toEqual({
      q: undefined,
      moods: undefined,
      from: undefined,
      to: undefined,
      sort: undefined,
    })
  })

  it('round-trips every condition the UI can set', () => {
    const search = {
      q: '커피',
      moods: ['JOY'],
      from: '2026-01-01',
      to: '2026-02-01',
      sort: 'oldest',
    }
    const parsed = parseDiarySearch(search)
    expect(diarySearchFromQuery(diaryQueryFromSearch(parsed))).toEqual(parsed)
  })
})

describe('searchWithUpdate', () => {
  it('merges onto the search it is given, not onto a snapshot the caller captured', () => {
    // Two controls touched inside one navigation round trip: the second update sees the first.
    const first = searchWithUpdate({}, (previous) => ({ ...previous, query: '커피' }))
    const second = searchWithUpdate(first, (previous) => ({ ...previous, moods: ['JOY'] }))
    expect(second.q).toBe('커피')
    expect(second.moods).toEqual(['JOY'])
  })

  it('toggles a mood against the live list', () => {
    const withJoy = searchWithUpdate({ moods: ['JOY'] }, (previous) => ({
      ...previous,
      moods: [...(previous.moods ?? []), 'SAD'],
    }))
    expect(withJoy.moods).toEqual(['JOY', 'SAD'])
  })

  it('carries view and month across a conditions change, so typing does not leave the calendar', () => {
    const next = searchWithUpdate({ view: 'calendar', month: '2026-05' }, (previous) => ({
      ...previous,
      query: '커피',
    }))
    expect(next).toMatchObject({ q: '커피', view: 'calendar', month: '2026-05' })
  })
})
