// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { createAppRouter } from './index.ts'
import { searchWithUpdate, type DiarySearchParams } from './diary-search.ts'

// The click-through path ([D12], A7) applies the date range and switches the view back to the list through
// TWO separate navigations inside one handler. If the router did not hand the LIVE search to the second
// updater, the second would overwrite the first and the chosen day's filter would silently vanish — so the
// composition is pinned here rather than assumed. The same round-trip property the search field relies on.
describe('a day selection survives the view switch that follows it (A7)', () => {
  it('lands on from/to for the chosen day, with the view back on the list and the month kept', async () => {
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => 'authenticated',
      initialEntries: ['/diary?view=calendar&month=2026-05'],
    })
    await router.load()
    expect(router.state.location.search).toMatchObject({ view: 'calendar', month: '2026-05' })

    // Exactly what DiaryReaderBlock.selectDay drives, in order: the conditions update, then the view.
    await router.navigate({
      to: '/diary',
      search: (previous: DiarySearchParams) =>
        searchWithUpdate(previous, (query) => ({
          ...query,
          from: '2026-05-04',
          to: '2026-05-04',
        })),
      replace: true,
    })
    await router.navigate({
      to: '/diary',
      search: (previous: DiarySearchParams): DiarySearchParams => ({
        ...previous,
        view: undefined,
      }),
      replace: true,
    })

    const search = router.state.location.search as DiarySearchParams
    expect(search.from).toBe('2026-05-04')
    expect(search.to).toBe('2026-05-04')
    expect(search.view).toBeUndefined()
    // The month is left alone, so toggling back into the calendar returns to where the reader was.
    expect(search.month).toBe('2026-05')
  })

  it('adds no history entry for the view swap and one for a month step', async () => {
    const router = createAppRouter({
      diagnosticsEnabled: false,
      getSessionStatus: () => 'authenticated',
      initialEntries: ['/diary'],
    })
    await router.load()
    const before = router.history.length

    // Mounting the calendar REPLACES — the toggle is a way of looking, not a place.
    await router.navigate({
      to: '/diary',
      search: (previous: DiarySearchParams): DiarySearchParams => ({
        ...previous,
        view: 'calendar',
      }),
      replace: true,
    })
    expect(router.history.length).toBe(before)

    // Stepping a month PUSHES, so Back returns the reader to the month they came from.
    await router.navigate({
      to: '/diary',
      search: (previous: DiarySearchParams): DiarySearchParams => ({
        ...previous,
        month: '2026-04',
      }),
    })
    expect(router.history.length).toBe(before + 1)
  })
})
