import { VALUES } from '@cosimosi/config'
import { moodColor } from '@cosimosi/emotion'
import { Button } from '@cosimosi/ui'
import { buildMonthGrid, stepMonth, type DayMark } from '@cosimosi/universe'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface DiaryCalendarProps {
  /** The displayed month, `YYYY-MM`. Its authority is the host — the URL on web, screen state on mobile. */
  month: string
  onMonthChange: (month: string) => void
  /** A written day was chosen. The host turns it into the archive's date filter and shows the list. */
  onSelectDay: (date: string) => void
  /** Written days only, keyed `YYYY-MM-DD`. An absent day was never written; `{mood: null}` lost its colour. */
  marks: ReadonlyMap<string, DayMark>
  isLoading: boolean
  isError: boolean
}

const WEEKDAY_LABELS: readonly (() => string)[] = [
  m.calendar_weekday_sun,
  m.calendar_weekday_mon,
  m.calendar_weekday_tue,
  m.calendar_weekday_wed,
  m.calendar_weekday_thu,
  m.calendar_weekday_fri,
  m.calendar_weekday_sat,
]

const DAYS_PER_WEEK = 7

// widgets/diary-calendar ui ([D12]): the archive's second shape — a month grid marking every day the
// user wrote on, in that day's representative mood colour. Free and time-frozen: it holds NO action slot
// of any kind (deliberately unlike DiaryList's `renderActions`), so there is no prop through which a paid
// affordance could reach a cell ([D11][T3][G4]). It renders no diary text — the read carries none ([D10]).
// Every hue comes from `moodColor`, so a palette swap recolours it with no change here ([M6]).
export function DiaryCalendar({
  month,
  onMonthChange,
  onSelectDay,
  marks,
  isLoading,
  isError,
}: DiaryCalendarProps) {
  const weekStart =
    ((Math.trunc(VALUES.diaryReader.calendarWeekStartDay) % DAYS_PER_WEEK) + DAYS_PER_WEEK) %
    DAYS_PER_WEEK
  const weeks = buildMonthGrid(month, weekStart)
  // Rotated with the grid, so the column a label names is the column it sits over.
  const weekdays = Array.from(
    { length: DAYS_PER_WEEK },
    (_, column) => WEEKDAY_LABELS[(weekStart + column) % DAYS_PER_WEEK],
  )
  const [year, monthNumber] = month.split('-')

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button color="neutral" size="sm" onClick={() => onMonthChange(stepMonth(month, -1))}>
          {m.calendar_prev_month_action()}
        </Button>
        <span className="text-sm font-medium text-text">
          {m.calendar_month_label({ year: year ?? '', month: monthNumber ?? '' })}
        </span>
        <Button color="neutral" size="sm" onClick={() => onMonthChange(stepMonth(month, 1))}>
          {m.calendar_next_month_action()}
        </Button>
      </div>

      {isError ? (
        <p className="text-sm text-text-muted">{m.calendar_error()}</p>
      ) : isLoading ? (
        <p className="text-sm text-text-muted">{m.calendar_loading()}</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1">
            {weekdays.map((label, column) => (
              <span key={column} className="py-1 text-center text-xs text-text-subtle" aria-hidden>
                {label?.()}
              </span>
            ))}
            {weeks.flat().map((cell) => {
              const mark = cell.inMonth ? marks.get(cell.date) : undefined
              const day = Number(cell.date.slice(8))
              if (!mark) {
                // An unwritten or out-of-month cell is inert: plain text, no role, no handler, no hover
                // affordance — the grid announces only days that hold writing ([D12]).
                return (
                  <span
                    key={cell.date}
                    aria-hidden
                    className={`flex flex-col items-center gap-1 rounded-lg py-1.5 text-sm ${
                      cell.inMonth ? 'text-text-muted' : 'text-text-subtle opacity-50'
                    }`}
                  >
                    {day}
                    {/* Holds the mark's height, so a marked and an unmarked row sit on the same baseline. */}
                    <span className="h-2 w-2" />
                  </span>
                )
              }
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => onSelectDay(cell.date)}
                  aria-label={
                    mark.mood
                      ? m.calendar_day_mood_hint({
                          date: cell.date,
                          mood: moodLabel(mark.mood),
                        })
                      : m.calendar_day_unmarked_hint({ date: cell.date })
                  }
                  className="flex flex-col items-center gap-1 rounded-lg py-1.5 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {day}
                  {mark.mood ? (
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: moodColor(mark.mood) }}
                    />
                  ) : (
                    // A written day holding no live mood: a border-token outline, never NEUTRAL's hue —
                    // asserting a colour here would claim a feeling the writer never recorded ([M3][X4]).
                    <span aria-hidden className="h-2 w-2 rounded-full border border-border" />
                  )}
                </button>
              )
            })}
          </div>
          {marks.size === 0 && (
            <p className="text-center text-sm text-text-subtle">{m.calendar_empty_month()}</p>
          )}
        </>
      )}
    </section>
  )
}
