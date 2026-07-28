// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRouterTransport } from '@connectrpc/connect'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { MemoryService } from '@cosimosi/api-client'
import { ErrorToastContext } from '@cosimosi/errors/react'
import { useReleasedGroupsStore } from '@cosimosi/universe'

import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'
import { DiaryReaderBlock } from './DiaryReaderBlock.tsx'

afterEach(cleanup)

// One written day in May 2026, so the calendar has a mark and the list has a row to show.
const DIARY_DATE = '2026-05-04'

function mount(
  view: 'list' | 'calendar',
  overrides: { onViewChange?: (v: 'list' | 'calendar') => void } = {},
) {
  const calls: string[] = []
  const transport = createRouterTransport(({ service }) => {
    service(MemoryService, {
      getDiaries: () => {
        calls.push('getDiaries')
        return {
          diaries: [
            {
              id: 'd1',
              body: 'the sea was cold',
              diaryDate: DIARY_DATE,
              createdUniverseTime: DIARY_DATE,
              memories: [{ episodicMemoryId: 'm1', name: 'sea', mood: 'JOY' }],
            },
          ],
          nextPageToken: '',
        }
      },
      getDiaryCalendar: () => {
        calls.push('getDiaryCalendar')
        return {
          days: [{ diaryDate: DIARY_DATE, moods: [{ mood: 'JOY', weight: 0.8 }] }],
          nextPageToken: '',
        }
      },
      syncStatus: () => ({ needsSync: false }),
    })
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const result = render(
    <TransportProvider transport={transport}>
      <QueryClientProvider client={queryClient}>
        <ErrorToastContext.Provider value={() => {}}>
          <DiaryReaderBlock
            onExit={() => {}}
            query={{}}
            onQueryChange={() => {}}
            view={view}
            onViewChange={overrides.onViewChange ?? (() => {})}
            month="2026-05"
            onMonthChange={() => {}}
          />
        </ErrorToastContext.Provider>
      </QueryClientProvider>
    </TransportProvider>,
  )
  return { ...result, calls }
}

describe('DiaryReaderBlock — the archive’s two shapes ([D12][A1])', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
    // The restore section renders nothing with no released group, so one is seeded to prove it SURVIVES
    // the view switch rather than merely being absent from both branches.
    useReleasedGroupsStore.getState().reset()
    useReleasedGroupsStore.getState().record({
      diaryId: 'released-1',
      deletedAt: '2026-05-01T00:00:00Z',
      episodicMemoryIds: ['m9'],
      removedMemories: [],
    })
  })

  it('keeps the header, the free note, the restore section and the search controls mounted in BOTH views', async () => {
    for (const view of ['list', 'calendar'] as const) {
      const { container, unmount } = mount(view)
      await waitFor(() => expect(container.textContent).toContain(m.diary_reader_title()))
      expect(container.textContent).toContain(m.diary_reader_free_note())
      expect(container.textContent).toContain(m.deletion_restore_section_title())
      expect(screen.queryByLabelText(m.diary_search_keyword_label())).not.toBeNull()
      expect(screen.queryByRole('button', { name: m.diary_reader_back() })).not.toBeNull()
      unmount()
      cleanup()
    }
  })

  it('swaps only the body: the list’s rows for the month grid', async () => {
    const list = mount('list')
    await waitFor(() => expect(list.container.textContent).toContain('the sea was cold'))
    expect(list.container.querySelector('.grid-cols-7')).toBeNull()
    list.unmount()
    cleanup()

    const calendar = mount('calendar')
    await waitFor(() => expect(calendar.container.querySelector('.grid-cols-7')).not.toBeNull())
    // No diary text of any kind reaches the calendar — the read carries none ([D10][A9]).
    expect(calendar.container.textContent).not.toContain('the sea was cold')
  })

  it('offers the two-option toggle and reports the chosen view to its host', async () => {
    const onViewChange = vi.fn()
    mount('list', { onViewChange })
    await userEvent
      .setup()
      .click(await screen.findByRole('radio', { name: m.calendar_view_action() }))
    expect(onViewChange).toHaveBeenCalledWith('calendar')
  })

  it('hides the sort control while the calendar shows, since it orders the list', async () => {
    const list = mount('list')
    await waitFor(() => expect(list.container.textContent).toContain(m.diary_reader_sort_label()))
    list.unmount()
    cleanup()

    const calendar = mount('calendar')
    await waitFor(() => expect(calendar.container.querySelector('.grid-cols-7')).not.toBeNull())
    expect(calendar.container.textContent).not.toContain(m.diary_reader_sort_label())
  })

  it('issues no calendar read at all while the list is showing', async () => {
    const list = mount('list')
    await waitFor(() => expect(list.container.textContent).toContain('the sea was cold'))
    expect(list.calls).toContain('getDiaries')
    expect(list.calls).not.toContain('getDiaryCalendar')
  })

  it('spends nothing and shows no paid affordance in the calendar ([D11][T3][A8])', async () => {
    const calendar = mount('calendar')
    await waitFor(() => expect(calendar.container.querySelector('.grid-cols-7')).not.toBeNull())
    // The list's one paid door is the whole-diary recall; the calendar exposes no slot for it.
    expect(calendar.container.textContent).not.toContain(m.diary_reader_recall_action())
    expect(calendar.container.textContent).not.toContain(m.deletion_delete_entry_action())
  })
})
