import type { DiaryDay } from '@cosimosi/memory'
import { describe, expect, it } from 'vitest'

import {
  buildMonthGrid,
  dayRepresentativeMood,
  monthDateRange,
  monthMarks,
  resolveCalendarMonth,
  stepMonth,
} from './diary-calendar.ts'

const day = (diaryDate: string, moods: readonly { mood: string; weight: number }[]): DiaryDay => ({
  diaryDate,
  moods,
})

describe('buildMonthGrid', () => {
  it('fits a February that starts on the week-start day into exactly four weeks', () => {
    // 2026-02-01 is a Sunday and February 2026 has 28 days, so the month tiles four full rows with no
    // borrowed cell at either end — the shortest grid the calendar can produce.
    const weeks = buildMonthGrid('2026-02', 0)
    expect(weeks).toHaveLength(4)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks[0]?.[0]).toEqual({ date: '2026-02-01', inMonth: true })
    expect(weeks[3]?.[6]).toEqual({ date: '2026-02-28', inMonth: true })
    expect(weeks.flat().every((cell) => cell.inMonth)).toBe(true)
  })

  it('spreads a 31-day month starting late in the week over six weeks', () => {
    // 2026-05-01 is a Friday: 5 leading cells + 31 days = 36, which cannot fit in five rows.
    const weeks = buildMonthGrid('2026-05', 0)
    expect(weeks).toHaveLength(6)
    expect(weeks.flat()).toHaveLength(42)
  })

  it('borrows leading and trailing cells from the adjacent months and marks them out-of-month', () => {
    const weeks = buildMonthGrid('2026-05', 0)
    const cells = weeks.flat()
    expect(cells.slice(0, 5)).toEqual([
      { date: '2026-04-26', inMonth: false },
      { date: '2026-04-27', inMonth: false },
      { date: '2026-04-28', inMonth: false },
      { date: '2026-04-29', inMonth: false },
      { date: '2026-04-30', inMonth: false },
    ])
    expect(cells[5]).toEqual({ date: '2026-05-01', inMonth: true })
    expect(cells[35]).toEqual({ date: '2026-05-31', inMonth: true })
    expect(cells[36]).toEqual({ date: '2026-06-01', inMonth: false })
    expect(cells.at(-1)).toEqual({ date: '2026-06-06', inMonth: false })
  })

  it('rotates the grid when the week starts on Monday', () => {
    // 2026-02-01 is a Sunday, so a Monday-first grid pushes it to the last column of a leading row.
    const weeks = buildMonthGrid('2026-02', 1)
    expect(weeks[0]?.[0]).toEqual({ date: '2026-01-26', inMonth: false })
    expect(weeks[0]?.[6]).toEqual({ date: '2026-02-01', inMonth: true })
  })

  it('crosses a year boundary in both directions', () => {
    const january = buildMonthGrid('2026-01', 0).flat()
    expect(january[0]?.date.startsWith('2025-12')).toBe(true)
    const december = buildMonthGrid('2025-12', 0).flat()
    expect(december.at(-1)?.date.startsWith('2026-01')).toBe(true)
  })

  it('gives a leap February 29 in-month days and a common one 28', () => {
    const leap = buildMonthGrid('2028-02', 0)
      .flat()
      .filter((cell) => cell.inMonth)
    expect(leap).toHaveLength(29)
    expect(leap.at(-1)?.date).toBe('2028-02-29')
    // 1900 is the century exception: divisible by 100 but not 400, so it is NOT a leap year.
    const century = buildMonthGrid('1900-02', 0)
      .flat()
      .filter((cell) => cell.inMonth)
    expect(century).toHaveLength(28)
  })

  it('keeps a date on its own day for a user west of UTC', () => {
    // The regression this module's string-only arithmetic exists for: `new Date('2026-03-01')` parses as
    // UTC midnight and reads back as 2026-02-28 in any negative offset, which would slide a mark a day.
    const original = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      const cells = buildMonthGrid('2026-03', 0).flat()
      expect(cells).toContainEqual({ date: '2026-03-01', inMonth: true })
      expect(monthDateRange('2026-03')).toEqual({ from: '2026-03-01', to: '2026-03-31' })
      expect(monthMarks([day('2026-03-01', [])]).has('2026-03-01')).toBe(true)
    } finally {
      process.env.TZ = original
    }
  })

  it('yields no rows for an unparsable month rather than guessing one', () => {
    expect(buildMonthGrid('2026-13', 0)).toEqual([])
    expect(buildMonthGrid('nonsense', 0)).toEqual([])
    expect(monthDateRange('2026-00')).toBeNull()
  })

  it('normalizes a week-start outside 0..6 instead of dropping cells', () => {
    expect(buildMonthGrid('2026-02', 7)).toEqual(buildMonthGrid('2026-02', 0))
    expect(buildMonthGrid('2026-02', -6)).toEqual(buildMonthGrid('2026-02', 1))
  })
})

describe('stepMonth / monthDateRange', () => {
  it('steps across both year boundaries', () => {
    expect(stepMonth('2026-01', -1)).toBe('2025-12')
    expect(stepMonth('2025-12', 1)).toBe('2026-01')
    expect(stepMonth('2026-07', -13)).toBe('2025-06')
  })

  it('bounds the range to the displayed month, whatever its length', () => {
    expect(monthDateRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthDateRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(monthDateRange('2026-04')).toEqual({ from: '2026-04-01', to: '2026-04-30' })
  })
})

describe('resolveCalendarMonth', () => {
  const july = new Date(2026, 6, 28, 12)

  it('prefers the month the host states explicitly', () => {
    expect(resolveCalendarMonth('2025-11', ['2026-07-01'], july)).toBe('2025-11')
  })

  it('falls back to the month of the newest cached diary, whatever the archive sort order', () => {
    const dates = ['2026-03-04', '2026-05-19', '2026-01-31']
    expect(resolveCalendarMonth(undefined, dates, july)).toBe('2026-05')
    expect(resolveCalendarMonth(undefined, [...dates].reverse(), july)).toBe('2026-05')
  })

  it('falls back to the device-local current month with an empty archive', () => {
    expect(resolveCalendarMonth(undefined, [], july)).toBe('2026-07')
    expect(resolveCalendarMonth(undefined, [], new Date(2026, 0, 1, 0))).toBe('2026-01')
  })

  it('ignores an unusable explicit month and an unusable cached date', () => {
    expect(resolveCalendarMonth('2026-13', [], july)).toBe('2026-07')
    expect(resolveCalendarMonth(undefined, ['not-a-date'], july)).toBe('2026-07')
  })
})

describe('dayRepresentativeMood', () => {
  it('takes the heaviest mood of the day', () => {
    expect(
      dayRepresentativeMood([
        { mood: 'SAD', weight: 0.2 },
        { mood: 'JOY', weight: 0.9 },
        { mood: 'CALM', weight: 0.5 },
      ]),
    ).toBe('JOY')
  })

  it('sums a mood that appears more than once before comparing', () => {
    expect(
      dayRepresentativeMood([
        { mood: 'CALM', weight: 0.3 },
        { mood: 'CALM', weight: 0.4 },
        { mood: 'JOY', weight: 0.6 },
      ]),
    ).toBe('CALM')
  })

  it('breaks an exact tie by mood name, inheriting toEmotionSlices order', () => {
    expect(
      dayRepresentativeMood([
        { mood: 'JOY', weight: 0.5 },
        { mood: 'ANGER', weight: 0.5 },
      ]),
    ).toBe('ANGER')
  })

  it('drops zero and negative weights', () => {
    expect(
      dayRepresentativeMood([
        { mood: 'JOY', weight: 0 },
        { mood: 'SAD', weight: -1 },
        { mood: 'CALM', weight: 0.1 },
      ]),
    ).toBe('CALM')
    expect(dayRepresentativeMood([{ mood: 'JOY', weight: 0 }])).toBeNull()
  })

  it('drops an unrecognized mood string to the outline rather than to a color', () => {
    expect(dayRepresentativeMood([{ mood: 'ELATION', weight: 9 }])).toBeNull()
    expect(
      dayRepresentativeMood([
        { mood: 'ELATION', weight: 9 },
        { mood: 'SAD', weight: 0.1 },
      ]),
    ).toBe('SAD')
  })

  it('returns null for a day with no mood rows at all', () => {
    expect(dayRepresentativeMood([])).toBeNull()
  })
})

describe('monthMarks', () => {
  it('marks a written day with its representative mood', () => {
    const marks = monthMarks([
      day('2026-07-01', [
        { mood: 'JOY', weight: 0.8 },
        { mood: 'SAD', weight: 0.2 },
      ]),
    ])
    expect(marks.get('2026-07-01')).toEqual({ mood: 'JOY' })
  })

  it('keeps a written day with no live mood present, with a null mood', () => {
    // Launched nothing, or every memory let go: the writing happened, so the day still shows — as the
    // outline the null mood resolves to at the render edge ([M3][X4]).
    const marks = monthMarks([day('2026-07-02', [])])
    expect(marks.has('2026-07-02')).toBe(true)
    expect(marks.get('2026-07-02')).toEqual({ mood: null })
  })

  it('leaves an unwritten day absent rather than present-with-null', () => {
    const marks = monthMarks([day('2026-07-02', [])])
    expect(marks.has('2026-07-03')).toBe(false)
    expect(marks.get('2026-07-03')).toBeUndefined()
  })

  it('keys marks by the verbatim wire date string', () => {
    const marks = monthMarks([day('2026-07-04', [{ mood: 'CALM', weight: 1 }])])
    expect([...marks.keys()]).toEqual(['2026-07-04'])
  })

  it('carries no color — the mark is a Mood, resolved to a hue only at the render edge', () => {
    const mark = monthMarks([day('2026-07-05', [{ mood: 'JOY', weight: 1 }])]).get('2026-07-05')
    expect(Object.keys(mark ?? {})).toEqual(['mood'])
  })
})
