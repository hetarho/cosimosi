import { MOODS, toEmotionSlices, type Mood } from '@cosimosi/emotion'
import type { DiaryDay, DiaryDayMood } from '@cosimosi/memory'

// The diary calendar's pure projection ([D12]): the month grid and the per-day representative mood.
// Presentation-only and palette-agnostic — it speaks Mood and never a color (§3.4), so a palette swap
// recolors the calendar with no change here ([M6]).
//
// Every date in this module is a `YYYY-MM-DD` or `YYYY-MM` STRING and every step is integer (y, m, d)
// arithmetic. `new Date(iso)` appears nowhere on purpose: a diary_date is a local civil date with no
// time component, and parsing one as ISO applies a UTC shift that would move a mark to the previous day
// for every user west of UTC ([W5]).

/** One day's mark. `mood: null` = written, but holding no live mood → the outline mark, never NEUTRAL. */
export interface DayMark {
  readonly mood: Mood | null
}

/** One grid cell. `inMonth: false` = a leading/trailing day borrowed from an adjacent month. */
export interface MonthCell {
  readonly date: string
  readonly inMonth: boolean
}

const DAYS_PER_WEEK = 7

const MOOD_SET: ReadonlySet<string> = new Set<string>(MOODS)

function isMood(value: string): value is Mood {
  return MOOD_SET.has(value)
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`
}

// The proleptic Gregorian rule, integer-only. A leap year is what decides February's length and hence
// whether a month grid needs five rows or four, so it cannot be delegated to Date.
function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

// Sakamoto's congruence: the weekday (0 = Sunday) of a civil date, computed from the integers alone.
const SAKAMOTO_OFFSETS: readonly number[] = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]

function weekdayOf(year: number, month: number, day: number): number {
  const shifted = month < 3 ? year - 1 : year
  const offset = SAKAMOTO_OFFSETS[month - 1] ?? 0
  return (
    (shifted +
      Math.floor(shifted / 4) -
      Math.floor(shifted / 100) +
      Math.floor(shifted / 400) +
      offset +
      day) %
    DAYS_PER_WEEK
  )
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  // Floor division, so a step back across January lands on the previous December rather than month 0.
  const zeroBased = year * 12 + (month - 1) + delta
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 }
}

function parseMonth(month: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!match?.[1] || !match[2]) return null
  return { year: Number(match[1]), month: Number(match[2]) }
}

/** The month `delta` steps from `month` (`'YYYY-MM'`), as `'YYYY-MM'`. An unparsable month is returned as-is. */
export function stepMonth(month: string, delta: number): string {
  const parsed = parseMonth(month)
  if (!parsed) return month
  const next = shiftMonth(parsed.year, parsed.month, delta)
  return `${String(next.year).padStart(4, '0')}-${pad2(next.month)}`
}

/** The inclusive `YYYY-MM-DD` bounds of a month — the calendar read's range, the displayed month only. */
export function monthDateRange(month: string): { from: string; to: string } | null {
  const parsed = parseMonth(month)
  if (!parsed) return null
  return {
    from: isoDate(parsed.year, parsed.month, 1),
    to: isoDate(parsed.year, parsed.month, daysInMonth(parsed.year, parsed.month)),
  }
}

/**
 * The grid for a month: 4–6 rows of 7 cells, the first column showing `weekStart` (0 = Sunday), with
 * leading/trailing cells borrowed from the adjacent months so every row is full. An unparsable month
 * yields no rows rather than a guessed one.
 */
export function buildMonthGrid(
  month: string,
  weekStart: number,
): readonly (readonly MonthCell[])[] {
  const parsed = parseMonth(month)
  if (!parsed) return []
  const { year, month: monthNumber } = parsed
  const start = ((Math.trunc(weekStart) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK
  const leading = (weekdayOf(year, monthNumber, 1) - start + DAYS_PER_WEEK) % DAYS_PER_WEEK
  const length = daysInMonth(year, monthNumber)

  const previous = shiftMonth(year, monthNumber, -1)
  const previousLength = daysInMonth(previous.year, previous.month)
  const next = shiftMonth(year, monthNumber, 1)

  const cells: MonthCell[] = []
  for (let index = 0; index < leading; index++) {
    const day = previousLength - leading + 1 + index
    cells.push({ date: isoDate(previous.year, previous.month, day), inMonth: false })
  }
  for (let day = 1; day <= length; day++) {
    cells.push({ date: isoDate(year, monthNumber, day), inMonth: true })
  }
  // Trailing cells fill the final row only — a whole extra week of borrowed days would claim the month
  // is longer than it is.
  const trailing = (DAYS_PER_WEEK - (cells.length % DAYS_PER_WEEK)) % DAYS_PER_WEEK
  for (let day = 1; day <= trailing; day++) {
    cells.push({ date: isoDate(next.year, next.month, day), inMonth: false })
  }

  const weeks: MonthCell[][] = []
  for (let index = 0; index < cells.length; index += DAYS_PER_WEEK) {
    weeks.push(cells.slice(index, index + DAYS_PER_WEEK))
  }
  return weeks
}

/**
 * Which month the calendar opens on. The host's explicit month wins; otherwise the month of the newest
 * diary already in the archive cache (the list is the default view, so its first page is always fetched
 * before the calendar can be reached), and failing that the device-local current month.
 *
 * The resolved value is deliberately NOT written back into the host's state: mounting the calendar must
 * add no history entry, while stepping does.
 *
 * `now` is read for its LOCAL year and month only — `getFullYear`/`getMonth` are local-time by definition,
 * so no UTC round trip happens here. The A11 ban is on PARSING an ISO date string, which this never does.
 */
export function resolveCalendarMonth(
  explicit: string | undefined,
  diaryDates: readonly string[],
  now: Date,
): string {
  if (explicit && parseMonth(explicit)) return explicit
  // `YYYY-MM-DD` sorts lexicographically the same way it sorts chronologically, so the newest date is the
  // string maximum — no parsing needed, and the archive's sort order cannot change the answer.
  let newest: string | null = null
  for (const date of diaryDates) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && (newest === null || date > newest)) newest = date
  }
  if (newest) return newest.slice(0, 7)
  return `${String(now.getFullYear()).padStart(4, '0')}-${pad2(now.getMonth() + 1)}`
}

/**
 * A day's representative mood: the top slice of `toEmotionSlices` over that day's `(mood, weight)` rows.
 * It inherits the slice order verbatim — `weight desc`, then `mood.localeCompare` for a tie — and the
 * drop-≤0 normalization, so the mark is the same weighted blend the universe paints ([M4]) collapsed to
 * its loudest emotion, never an average and never a per-diary representative.
 *
 * The slice's `color` is discarded on purpose: `toEmotionSlices` resolves one internally, and taking it
 * would put a hue in the pure layer (§3.4). An unrecognized mood string cannot key the Map and so drops
 * out, coercing the day to the outline rather than to a color — an unknown mood never borrows a hue ([M3]).
 */
export function dayRepresentativeMood(rows: readonly DiaryDayMood[]): Mood | null {
  const weights = new Map<Mood, number>()
  for (const row of rows) {
    if (!isMood(row.mood)) continue
    weights.set(row.mood, (weights.get(row.mood) ?? 0) + row.weight)
  }
  return toEmotionSlices(weights)[0]?.mood ?? null
}

/**
 * The marks for a month's written days, keyed by `YYYY-MM-DD`. One entry per day the read returned —
 * including a day whose `moods` was empty, which maps to `{mood: null}`. An UNWRITTEN day is ABSENT from
 * the map, never present-with-null: absent means "nothing was written" and present-with-null means
 * "written, nothing survives to color it", and the grid draws two different things for them.
 */
export function monthMarks(days: readonly DiaryDay[]): ReadonlyMap<string, DayMark> {
  const marks = new Map<string, DayMark>()
  for (const day of days) {
    marks.set(day.diaryDate, { mood: dayRepresentativeMood(day.moods) })
  }
  return marks
}
