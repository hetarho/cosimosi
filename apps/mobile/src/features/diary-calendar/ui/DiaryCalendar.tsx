import { Pressable, StyleSheet, Text, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { moodColor } from '@cosimosi/emotion'
import { Button, tokens } from '@cosimosi/ui'
import { buildMonthGrid, stepMonth, type DayMark } from '@cosimosi/universe'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface DiaryCalendarProps {
  /** The displayed month, `YYYY-MM`. Its authority is the host — screen state here, the URL on web. */
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

// widgets/diary-calendar ui (RN fork, [D12]): the archive's second shape — a month grid of View rows
// marking every day the user wrote on, in that day's representative mood colour. Free and time-frozen: it
// holds NO action slot of any kind (deliberately unlike DiaryList's `renderActions`), so there is no prop
// through which a paid affordance could reach a cell ([D11][T3][G4]). It renders no diary text — the read
// carries none ([D10]). Every hue comes from `moodColor` ([M6]). Shares its month/mark projection with web.
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
    <View style={styles.block}>
      <View style={styles.monthRow}>
        <Button color="neutral" size="sm" onPress={() => onMonthChange(stepMonth(month, -1))}>
          {m.calendar_prev_month_action()}
        </Button>
        <Text style={styles.monthLabel}>
          {m.calendar_month_label({ year: year ?? '', month: monthNumber ?? '' })}
        </Text>
        <Button color="neutral" size="sm" onPress={() => onMonthChange(stepMonth(month, 1))}>
          {m.calendar_next_month_action()}
        </Button>
      </View>

      {isError ? (
        <Text style={styles.notice}>{m.calendar_error()}</Text>
      ) : isLoading ? (
        <Text style={styles.notice}>{m.calendar_loading()}</Text>
      ) : (
        <View style={styles.grid}>
          <View style={styles.week}>
            {weekdays.map((label, column) => (
              <Text key={column} style={styles.weekday}>
                {label?.()}
              </Text>
            ))}
          </View>
          {weeks.map((week) => (
            <View key={week[0]?.date} style={styles.week}>
              {week.map((cell) => {
                const mark = cell.inMonth ? marks.get(cell.date) : undefined
                const day = Number(cell.date.slice(8))
                if (!mark) {
                  // An unwritten or out-of-month cell is inert: plain text, no Pressable, no
                  // accessibility role — the grid announces only days that hold writing ([D12]).
                  return (
                    <View key={cell.date} style={styles.cell}>
                      <Text style={cell.inMonth ? styles.dayMuted : styles.dayOutOfMonth}>
                        {day}
                      </Text>
                      {/* Holds the mark's height, so a marked and an unmarked row share one baseline. */}
                      <View style={styles.markSlot} />
                    </View>
                  )
                }
                return (
                  <Pressable
                    key={cell.date}
                    style={styles.cell}
                    onPress={() => onSelectDay(cell.date)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      mark.mood
                        ? m.calendar_day_mood_hint({
                            date: cell.date,
                            mood: moodLabel(mark.mood),
                          })
                        : m.calendar_day_unmarked_hint({ date: cell.date })
                    }
                  >
                    <Text style={styles.day}>{day}</Text>
                    {mark.mood ? (
                      <View style={[styles.markSlot, { backgroundColor: moodColor(mark.mood) }]} />
                    ) : (
                      // A written day holding no live mood: a border-token outline, never NEUTRAL's hue —
                      // asserting a colour here would claim a feeling the writer never recorded ([M3][X4]).
                      <View style={[styles.markSlot, styles.markOutline]} />
                    )}
                  </Pressable>
                )
              })}
            </View>
          ))}
          {marks.size === 0 && <Text style={styles.emptyMonth}>{m.calendar_empty_month()}</Text>}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: tokens.spacing[3] },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[2],
  },
  monthLabel: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  notice: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  grid: { gap: tokens.spacing[1] },
  week: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: tokens.color['text-subtle'],
    fontSize: tokens.fontSize.xs,
    paddingVertical: tokens.spacing[1],
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.spacing[1],
    paddingVertical: tokens.spacing[1],
  },
  day: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  dayMuted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  dayOutOfMonth: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.sm, opacity: 0.5 },
  markSlot: { width: 8, height: 8, borderRadius: 4 },
  markOutline: { borderWidth: 1, borderColor: tokens.color.border },
  emptyMonth: {
    color: tokens.color['text-subtle'],
    fontSize: tokens.fontSize.sm,
    textAlign: 'center',
    paddingTop: tokens.spacing[2],
  },
})
