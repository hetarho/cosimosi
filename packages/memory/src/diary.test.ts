import { describe, expect, it } from 'vitest'

import {
  diaryMoods,
  diaryPreview,
  highlightSegments,
  isDateRangeUsable,
  isKeywordSearchable,
  shouldAdoptCommitted,
} from './diary.ts'

describe('diaryPreview', () => {
  it('collapses every whitespace run to one space and trims the edges', () => {
    expect(diaryPreview('  아침에\n\n커피를   마셨다  ', 100)).toBe('아침에 커피를 마셨다')
  })

  it('returns the body unchanged when it fits, with no ellipsis', () => {
    expect(diaryPreview('짧은 하루', 100)).toBe('짧은 하루')
  })

  it('appends the ellipsis only when truncating, and does not count it in the length', () => {
    expect(diaryPreview('abcdefghij', 4)).toBe('abcd…')
    expect(diaryPreview('abcd', 4)).toBe('abcd')
  })

  it('slices code points, so an astral character is never cut in half', () => {
    // Three code points, six UTF-16 units — a .slice(0, 2) would emit a lone surrogate.
    const body = '🌌🌠🪐'
    expect(diaryPreview(body, 2)).toBe('🌌🌠…')
    expect(Array.from(diaryPreview(body, 2))).toHaveLength(3)
  })

  it('yields an empty preview for a non-positive length', () => {
    expect(diaryPreview('무엇이든', 0)).toBe('')
  })
})

describe('highlightSegments', () => {
  it('returns one unmatched segment when the query is blank', () => {
    expect(highlightSegments('커피를 마셨다', '  ')).toEqual([
      { text: '커피를 마셨다', match: false },
    ])
  })

  it('returns one unmatched segment when nothing matches', () => {
    expect(highlightSegments('커피를 마셨다', '홍차')).toEqual([
      { text: '커피를 마셨다', match: false },
    ])
  })

  it('marks every occurrence and preserves the original casing', () => {
    expect(highlightSegments('Coffee then coffee', 'COFFEE')).toEqual([
      { text: 'Coffee', match: true },
      { text: ' then ', match: false },
      { text: 'coffee', match: true },
    ])
  })

  it('matches a Korean substring the way the server ILIKE does', () => {
    expect(highlightSegments('커피를 마셨다', '커피')).toEqual([
      { text: '커피', match: true },
      { text: '를 마셨다', match: false },
    ])
  })

  it('treats SQL wildcards as literal text', () => {
    expect(highlightSegments('100% 확신', '%')).toEqual([
      { text: '100', match: false },
      { text: '%', match: true },
      { text: ' 확신', match: false },
    ])
    expect(highlightSegments('a_b', '_')).toEqual([
      { text: 'a', match: false },
      { text: '_', match: true },
      { text: 'b', match: false },
    ])
  })

  it('segments the input rather than excerpting around the hit', () => {
    // [D10]: the visible text stays the prefix the preview produced — no match-centred snippet.
    const segments = highlightSegments('one two three', 'three')
    expect(segments.map((segment) => segment.text).join('')).toBe('one two three')
  })

  it('marks the typed characters even when case folding changes length', () => {
    // 'İ'.toLowerCase() is two code units, so an index taken in a folded copy slides every later
    // slice — the reader would see neighbouring characters marked instead of the ones they typed.
    expect(highlightSegments('İstanbul', 'stan')).toEqual([
      { text: 'İ', match: false },
      { text: 'stan', match: true },
      { text: 'bul', match: false },
    ])
    expect(highlightSegments('İstanbul is warm', 'warm')).toEqual([
      { text: 'İstanbul is ', match: false },
      { text: 'warm', match: true },
    ])
    // A character absent from the query must never be marked.
    expect(
      highlightSegments('aİbcİd', 'c').every(
        (segment) => !segment.match || segment.text.toLowerCase() === 'c',
      ),
    ).toBe(true)
  })

  it('marks a query that covers the whole text', () => {
    expect(highlightSegments('coffee', 'coffee')).toEqual([{ text: 'coffee', match: true }])
  })

  it('never drops or duplicates a character, whatever the query', () => {
    for (const body of ['İstanbul is warm', 'aİbcİd', 'coffee', '100% 확신', '커피를 마셨다']) {
      for (const query of ['c', 'İ', '%', '커피', 'coffee', 'zz']) {
        expect(
          highlightSegments(body, query)
            .map((segment) => segment.text)
            .join(''),
        ).toBe(body)
      }
    }
  })
})

describe('diaryMoods', () => {
  const member = (mood: string, index: number) => ({
    episodicMemoryId: `m${index}`,
    name: `n${index}`,
    mood,
  })

  it('keeps each mood once, in MOODS declaration order', () => {
    const moods = diaryMoods(['SAD', 'JOY', 'SAD'].map(member))
    expect(moods).toEqual(['JOY', 'SAD'])
  })

  it('yields nothing for a diary with no live memory, so the row draws no dot', () => {
    expect(diaryMoods([])).toEqual([])
  })

  it('ignores a mood name the palette does not know', () => {
    expect(diaryMoods([member('NOT_A_MOOD', 0)])).toEqual([])
  })
})

describe('isKeywordSearchable', () => {
  it('accepts an empty keyword — no keyword is not a short keyword', () => {
    expect(isKeywordSearchable('', 2)).toBe(true)
    expect(isKeywordSearchable('   ', 2)).toBe(true)
  })

  it('refuses a keyword the read would refuse, counting the trimmed length', () => {
    expect(isKeywordSearchable('a', 2)).toBe(false)
    expect(isKeywordSearchable('  a  ', 2)).toBe(false)
    expect(isKeywordSearchable('커피', 2)).toBe(true)
  })
})

describe('isDateRangeUsable', () => {
  it('accepts an absent side', () => {
    expect(isDateRangeUsable('', '')).toBe(true)
    expect(isDateRangeUsable('2026-01-01', '')).toBe(true)
    expect(isDateRangeUsable('', '2026-01-01')).toBe(true)
  })

  it('refuses a half-typed date, so typing a date is not a refused read per keystroke', () => {
    for (const partial of ['2', '2026', '2026-0', '2026-01-', 'yesterday']) {
      expect(isDateRangeUsable(partial, '')).toBe(false)
      expect(isDateRangeUsable('', partial)).toBe(false)
    }
  })

  it('refuses an inverted range and accepts an equal one', () => {
    expect(isDateRangeUsable('2026-06-01', '2026-01-01')).toBe(false)
    expect(isDateRangeUsable('2026-01-01', '2026-01-01')).toBe(true)
    expect(isDateRangeUsable('2026-01-01', '2026-06-01')).toBe(true)
  })
})

describe('shouldAdoptCommitted', () => {
  it('leaves a draft alone when the commit is only its trimmed form', () => {
    // Committing trims, so a reader who paused after a space must not lose it mid-phrase.
    expect(shouldAdoptCommitted('coffee ', 'coffee')).toBe(false)
    expect(shouldAdoptCommitted(' coffee', 'coffee')).toBe(false)
  })

  it('adopts a value changed outside the field', () => {
    expect(shouldAdoptCommitted('coffee ', '')).toBe(true)
    expect(shouldAdoptCommitted('coffee', 'tea')).toBe(true)
  })
})
