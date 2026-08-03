import { useCallback, useMemo } from 'react'

import { useSearch } from '@tanstack/react-router'

import type { DiaryConditionsUpdate } from '@cosimosi/universe/react'

import { DiaryReaderPage } from '../../../pages/diary-reader/index.ts'
import { diaryQueryFromSearch, searchWithUpdate, type DiarySearchParams } from '../diary-search.ts'
import { useAppNavigate } from '../navigation.ts'

// Reached through a dynamic import from `route-tree.tsx` — see `universe-route.tsx` for why each
// signed-in screen owns its own module.
export function DiaryReaderRoute() {
  const navigate = useAppNavigate()
  const search = useSearch({ strict: false }) as DiarySearchParams
  // Both are held stable across renders because they reach the archive read's query key and the
  // search feature's commit effect: a fresh object or callback on every render would churn both.
  const query = useMemo(() => diaryQueryFromSearch(search), [search])
  // Replace rather than push: a debounced keystroke must not bury the universe under a hundred
  // history entries, while a deliberate Back still leaves the archive ([D7]).
  const onQueryChange = useCallback(
    (update: DiaryConditionsUpdate) =>
      navigate({
        to: '/diary',
        search: (previous: DiarySearchParams) => searchWithUpdate(previous, update),
        replace: true,
      }),
    [navigate],
  )
  // Mounting the calendar must add NO history entry — the toggle is a way of looking, not a place — so the
  // view swap replaces. Stepping a month is a move the reader may want to undo, so it pushes ([D12]).
  const onViewChange = useCallback(
    (view: 'list' | 'calendar') =>
      navigate({
        to: '/diary',
        search: (previous: DiarySearchParams): DiarySearchParams => ({
          ...previous,
          view: view === 'calendar' ? 'calendar' : undefined,
        }),
        replace: true,
      }),
    [navigate],
  )
  const onMonthChange = useCallback(
    (month: string) =>
      navigate({
        to: '/diary',
        search: (previous: DiarySearchParams) => ({ ...previous, month }),
      }),
    [navigate],
  )
  return (
    <DiaryReaderPage
      onExit={() => navigate({ to: '/universe' })}
      query={query}
      onQueryChange={onQueryChange}
      view={search.view === 'calendar' ? 'calendar' : 'list'}
      onViewChange={onViewChange}
      month={search.month}
      onMonthChange={onMonthChange}
    />
  )
}
