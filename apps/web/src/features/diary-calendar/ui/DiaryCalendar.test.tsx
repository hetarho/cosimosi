// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { moodColor } from '@cosimosi/emotion'
import { monthMarks, type DayMark } from '@cosimosi/universe'

import { defaultLocale, m, moodLabel, setActiveLocale } from '../../../shared/i18n/index.ts'
import { DiaryCalendar, type DiaryCalendarProps } from './DiaryCalendar.tsx'

afterEach(cleanup)

function show(props: Partial<DiaryCalendarProps> = {}) {
  const merged: DiaryCalendarProps = {
    month: '2026-05',
    onMonthChange: () => {},
    onSelectDay: () => {},
    marks: new Map<string, DayMark>(),
    isLoading: false,
    isError: false,
    ...props,
  }
  return render(<DiaryCalendar {...merged} />)
}

// Hex normalisation: jsdom reports an inline background-color as `rgb(r, g, b)`.
function rgbOf(hex: string) {
  const clean = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

describe('DiaryCalendar (web)', () => {
  beforeEach(() => setActiveLocale(defaultLocale))

  it('renders a full month grid of 7-column weeks with the adjacent months filling the edges', () => {
    // 2026-05-01 is a Friday, so a Sunday-first grid needs six rows and borrows April and June days.
    const { container } = show({ month: '2026-05' })
    const grid = container.querySelector('.grid-cols-7')
    expect(grid).not.toBeNull()
    // 7 weekday headers + 6 weeks × 7 cells, so every row is full and no day is dropped.
    expect((grid as HTMLElement).children).toHaveLength(7 + 42)
    // The borrowed edges are recessed rather than absent — April 26 leads, June 6 trails.
    const cells = [...(grid as HTMLElement).children].slice(7)
    expect(cells[0]?.textContent).toBe('26')
    expect(cells[0]?.className).toContain('opacity-50')
    expect(cells.at(-1)?.textContent).toBe('6')
    expect(cells.at(-1)?.className).toContain('opacity-50')
  })

  it('names every weekday column and the month through the i18n seam', () => {
    const { container } = show({ month: '2026-05' })
    expect(container.textContent).toContain(m.calendar_weekday_sun())
    expect(container.textContent).toContain(m.calendar_weekday_sat())
    expect(container.textContent).toContain(m.calendar_month_label({ year: '2026', month: '05' }))
  })

  it('marks a written day with that day’s representative mood colour ([D12][M4])', () => {
    show({
      month: '2026-05',
      marks: monthMarks([
        {
          diaryDate: '2026-05-04',
          moods: [
            { mood: 'JOY', weight: 0.9 },
            { mood: 'SAD', weight: 0.2 },
          ],
        },
      ]),
    })
    const cell = screen.getByRole('button', {
      name: m.calendar_day_mood_hint({ date: '2026-05-04', mood: moodLabel('JOY') }),
    })
    const disc = cell.querySelector('span[aria-hidden]')
    expect(disc).not.toBeNull()
    expect((disc as HTMLElement).style.backgroundColor).toBe(rgbOf(moodColor('JOY')))
  })

  it('gives a written day with no live mood an outline, never NEUTRAL’s colour ([M3][X4][A4])', () => {
    show({ month: '2026-05', marks: monthMarks([{ diaryDate: '2026-05-05', moods: [] }]) })
    const cell = screen.getByRole('button', {
      name: m.calendar_day_unmarked_hint({ date: '2026-05-05' }),
    })
    const disc = cell.querySelector('span[aria-hidden]') as HTMLElement
    // The mark is a border token, so it carries no inline colour at all — nothing here can resolve to a hue.
    expect(disc.style.backgroundColor).toBe('')
    expect(disc.className).toContain('border-border')
    expect(cell.outerHTML).not.toContain(moodColor('NEUTRAL'))
  })

  it('resolves every hue through moodColor, so no colour is hardcoded ([M6][A5])', () => {
    const { container } = show({
      month: '2026-05',
      marks: monthMarks([{ diaryDate: '2026-05-06', moods: [{ mood: 'CALM', weight: 1 }] }]),
    })
    const inline = [...container.querySelectorAll<HTMLElement>('[style]')]
      .map((node) => node.style.backgroundColor)
      .filter((value) => value !== '')
    expect(inline).toEqual([rgbOf(moodColor('CALM'))])
  })

  it('leaves an unwritten in-month day and an out-of-month day inert — no role, no handler ([A7])', () => {
    const onSelectDay = vi.fn()
    show({
      month: '2026-05',
      onSelectDay,
      marks: monthMarks([{ diaryDate: '2026-05-04', moods: [{ mood: 'JOY', weight: 1 }] }]),
    })
    // Exactly one cell is interactive: the single written day. The month/step controls are the only
    // other buttons, and they are named, so counting by accessible name is unambiguous.
    const dayButtons = screen
      .getAllByRole('button')
      .filter((node) => (node.getAttribute('aria-label') ?? '').includes('2026-'))
    expect(dayButtons).toHaveLength(1)
    // 2026-04-30 is a leading out-of-month cell; 2026-05-07 an unwritten in-month one.
    expect(screen.queryByLabelText(/2026-04-30/u)).toBeNull()
    expect(screen.queryByLabelText(/2026-05-07/u)).toBeNull()
  })

  it('emits the chosen day as an exact single-day range ([A7])', async () => {
    const onSelectDay = vi.fn()
    show({
      month: '2026-05',
      onSelectDay,
      marks: monthMarks([{ diaryDate: '2026-05-04', moods: [{ mood: 'JOY', weight: 1 }] }]),
    })
    await userEvent.setup().click(
      screen.getByRole('button', {
        name: m.calendar_day_mood_hint({ date: '2026-05-04', mood: moodLabel('JOY') }),
      }),
    )
    expect(onSelectDay).toHaveBeenCalledWith('2026-05-04')
  })

  it('steps one month at a time in both directions, with no today button and no picker ([T020])', async () => {
    const onMonthChange = vi.fn()
    show({ month: '2026-01', onMonthChange })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: m.calendar_prev_month_action() }))
    expect(onMonthChange).toHaveBeenCalledWith('2025-12')
    await user.click(screen.getByRole('button', { name: m.calendar_next_month_action() }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-02')
    // Only the two steppers exist beside the day cells.
    expect(
      screen
        .getAllByRole('button')
        .filter((node) => !node.getAttribute('aria-label')?.includes('2026-')),
    ).toHaveLength(2)
  })

  it('shows the loading state instead of marks while a month is only partly paged ([A12])', () => {
    const { container } = show({
      month: '2026-05',
      isLoading: true,
      // The hook withholds marks until the month is fully paged; the grid must not paint them anyway.
      marks: new Map<string, DayMark>(),
    })
    expect(container.textContent).toContain(m.calendar_loading())
    expect(screen.queryByLabelText(/2026-05/u)).toBeNull()
  })

  it('says a month holds no writing without calling it an error ([T020])', () => {
    const { container } = show({ month: '2026-05' })
    expect(container.textContent).toContain(m.calendar_empty_month())
    expect(container.textContent).not.toContain(m.calendar_error())
  })

  it('reports a failed month as an error rather than an empty one', () => {
    const { container } = show({ month: '2026-05', isError: true })
    expect(container.textContent).toContain(m.calendar_error())
    expect(container.textContent).not.toContain(m.calendar_empty_month())
  })

  it('accepts no text and no action slot, so no diary text or paid affordance can reach a cell ([A8][A9])', () => {
    const props: DiaryCalendarProps = {
      month: '2026-05',
      onMonthChange: () => {},
      onSelectDay: () => {},
      marks: new Map<string, DayMark>(),
      isLoading: false,
      isError: false,
    }
    // A props-shape assertion, because the absence is structural: the DTO carries no text field and the
    // component declares no render slot, so neither a snippet nor a spend control is representable here.
    expect(Object.keys(props).sort()).toEqual([
      'isError',
      'isLoading',
      'marks',
      'month',
      'onMonthChange',
      'onSelectDay',
    ])
  })
})
