import { useCallback, useEffect, useState } from 'react'
import type { GetDiariesInput } from '@cosimosi/api-client'
import { resolveCalendarMonth } from '../diary-calendar.ts'
import { useOpenDiaryTargetStore } from '../open-diary-target-store.ts'
import { useDiaryArchive } from './use-diary-archive.ts'
import { useDiaryCalendar } from './use-diary-calendar.ts'
import type { DiaryConditionsUpdate } from './use-diary-conditions.ts'

export interface DiaryArchiveNavigationInput {
  // The archive's conditions, view and month live with the host — the URL on web, screen state on
  // mobile — so a filtered archive survives a reload and Back restores the previous conditions.
  query: GetDiariesInput
  onQueryChange(update: DiaryConditionsUpdate): void
  view: 'list' | 'calendar'
  month?: string
}

// The ORDER is deliberately absent: it narrows nothing, so an archive read oldest-first is not a
// filtered archive and 조건 지우기 must not turn it back over.
export function diaryConditionsActive(query: GetDiariesInput): boolean {
  return (
    (query.query ?? '') !== '' ||
    (query.moods ?? []).length > 0 ||
    (query.from ?? '') !== '' ||
    (query.to ?? '') !== '' ||
    query.minMemories !== undefined ||
    query.maxMemories !== undefined
  )
}

// useDiaryArchiveNavigation is the diary reader's navigation state, shared by both apps' blocks: the
// opened entry and its eviction, condition changes and 조건 지우기, the calendar's resolved month, the
// picked day's read, and a deep link paging the archive to a star's diary.
export function useDiaryArchiveNavigation({
  query,
  onQueryChange,
  view,
  month,
}: DiaryArchiveNavigationInput) {
  const archive = useDiaryArchive(query)
  const { diaries, isLoading, hasMore, isLoadingMore, loadMore } = archive
  const [openedDiaryId, setOpenedDiaryId] = useState<string | null>(null)

  // Any condition change starts a fresh keyset page, so the opened entry may not be in the new result
  // set and the reader should be looking at the top of it.
  const changeQuery = useCallback(
    (update: DiaryConditionsUpdate) => {
      setOpenedDiaryId(null)
      onQueryChange(update)
    },
    [onQueryChange],
  )
  const conditionsActive = diaryConditionsActive(query)
  const clearConditions = useCallback(() => {
    changeQuery((previous) => ({
      ...previous,
      query: '',
      moods: [],
      from: '',
      to: '',
      minMemories: undefined,
      maxMemories: undefined,
    }))
  }, [changeQuery])

  // The month is RESOLVED rather than stored, from the archive page the list has already fetched, and
  // is never written back — mounting the calendar must add no history entry, while stepping does.
  const displayedMonth = resolveCalendarMonth(
    month,
    diaries.map((diary) => diary.diaryDate),
    new Date(),
  )
  const calendar = useDiaryCalendar(displayedMonth, view === 'calendar')

  // Selecting a day opens that day's writing over the calendar — the DAY, not a guessed entry: a day
  // may hold several diaries. The read is bounded by the DATE ALONE, deliberately: the grid marks
  // every day that holds writing regardless of the keyword or mood chips, so a marked day must open
  // to what it is marked for. It is issued only once a day is picked.
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  const dayArchive = useDiaryArchive(
    { sort: query.sort, from: dayModalDate ?? '', to: dayModalDate ?? '' },
    { enabled: dayModalDate !== null, mirror: false },
  )
  // Held here rather than inside the search panel: the archive body swaps between branches as reads
  // settle, and a disclosure owned down there would refold every time one did.
  const [moodsOpen, setMoodsOpen] = useState(false)

  const deepLinkMemoryId = useOpenDiaryTargetStore((state) => state.memoryId)
  const clearDeepLink = useOpenDiaryTargetStore((state) => state.clear)
  useEffect(() => {
    if (!deepLinkMemoryId) return
    // An entry the reader opened themselves outranks a request still paging for its diary: swapping
    // the body under an open surface would replace what they are reading with something they never
    // asked for. The request is dropped rather than queued — they are already in the archive.
    if (openedDiaryId) {
      clearDeepLink()
      return
    }
    const match = diaries.find((diary) =>
      diary.memories.some((member) => member.episodicMemoryId === deepLinkMemoryId),
    )
    if (match) {
      setOpenedDiaryId(match.id)
      clearDeepLink()
      return
    }
    // The archive the star's diary must be found in is the whole archive: paging a filtered one would
    // run out of pages and drop the request, so the conditions are lifted first and the search then
    // continues over every entry.
    if (conditionsActive) {
      clearConditions()
      return
    }
    if (hasMore && !isLoadingMore) loadMore()
    else if (!hasMore) clearDeepLink()
  }, [
    deepLinkMemoryId,
    diaries,
    hasMore,
    isLoadingMore,
    loadMore,
    clearDeepLink,
    conditionsActive,
    clearConditions,
    openedDiaryId,
  ])

  const openedDiary = openedDiaryId
    ? (diaries.find((diary) => diary.id === openedDiaryId) ?? null)
    : null
  // The archive can lose the entry under an open surface — a release elsewhere, a refetch that returns
  // a shorter set. Letting the id outlive its diary would make the surface reappear the moment a later
  // page happened to carry that id again, unprompted.
  useEffect(() => {
    if (openedDiaryId && !openedDiary && !isLoading) setOpenedDiaryId(null)
  }, [openedDiaryId, openedDiary, isLoading])

  return {
    archive,
    openedDiaryId,
    openedDiary,
    openDiary: setOpenedDiaryId,
    closeDiary: useCallback(() => setOpenedDiaryId(null), []),
    changeQuery,
    conditionsActive,
    clearConditions,
    displayedMonth,
    calendar,
    dayModalDate,
    selectDay: useCallback((date: string) => setDayModalDate(date), []),
    closeDay: useCallback(() => setDayModalDate(null), []),
    dayArchive,
    moodsOpen,
    setMoodsOpen,
  }
}
