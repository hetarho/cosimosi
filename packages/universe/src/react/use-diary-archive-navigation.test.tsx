// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GetDiariesInput } from '@cosimosi/api-client'

import { useDiaryStore } from '../diary-store.ts'
import { useOpenDiaryTargetStore } from '../open-diary-target-store.ts'
import { createFlowHarness } from './flow-test-harness.tsx'
import { diaryConditionsActive, useDiaryArchiveNavigation } from './use-diary-archive-navigation.ts'

const diary = (index: number) => ({
  id: `diary-${index}`,
  body: `entry ${index}`,
  diaryDate: `2026-06-${String(index).padStart(2, '0')}`,
  createdUniverseTime: `2026-06-${String(index).padStart(2, '0')}`,
  memories: [{ episodicMemoryId: `memory-${index}`, name: `memory ${index}`, mood: 'JOY' }],
})

// A three-page archive of two diaries each; pageToken is the page index.
function pagedArchive() {
  const pages = [
    [diary(6), diary(5)],
    [diary(4), diary(3)],
    [diary(2), diary(1)],
  ]
  const requested: string[] = []
  let removed: string | null = null
  const getDiaries = vi.fn((request: { pageToken: string }) => {
    requested.push(request.pageToken)
    const page = Number(request.pageToken || '0')
    return {
      diaries: pages[page]!.filter((entry) => entry.id !== removed),
      nextPageToken: page + 1 < pages.length ? String(page + 1) : '',
    }
  })
  return { getDiaries, requested, remove: (id: string) => (removed = id) }
}

function renderNavigation(query: GetDiariesInput, archive = pagedArchive()) {
  const onQueryChange = vi.fn()
  const { wrapper, queryClient } = createFlowHarness({ memory: { getDiaries: archive.getDiaries } })
  const rendered = renderHook(
    () => useDiaryArchiveNavigation({ query, onQueryChange, view: 'list' }),
    { wrapper },
  )
  return { archive, onQueryChange, queryClient, ...rendered }
}

describe('useDiaryArchiveNavigation', () => {
  // Unmount every rendered hook so a store subscription never outlives its test.
  afterEach(cleanup)

  beforeEach(() => {
    useOpenDiaryTargetStore.getState().clear()
    useDiaryStore.getState().clear()
  })

  it('pages a deep link only as far as the target diary, then opens it', async () => {
    const { archive, result } = renderNavigation({})
    await waitFor(() => expect(result.current.archive.diaries).toHaveLength(2))

    act(() => useOpenDiaryTargetStore.getState().request('memory-3'))

    await waitFor(() => expect(result.current.openedDiary?.id).toBe('diary-3'))
    expect(archive.requested).toEqual(['', '1'])
    expect(useOpenDiaryTargetStore.getState().memoryId).toBeNull()
  })

  it('lifts the conditions before paging for a deep link', async () => {
    const { result, onQueryChange } = renderNavigation({ query: 'harbor' })
    await waitFor(() => expect(result.current.archive.isLoading).toBe(false))

    act(() => useOpenDiaryTargetStore.getState().request('memory-1'))

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled())
    const update = onQueryChange.mock.calls[0]![0] as (previous: GetDiariesInput) => GetDiariesInput
    expect(diaryConditionsActive(update({ query: 'harbor', sort: 0 }))).toBe(false)
  })

  it('evicts an opened entry the archive no longer carries', async () => {
    const { archive, queryClient, result } = renderNavigation({})
    await waitFor(() => expect(result.current.archive.diaries).toHaveLength(2))
    act(() => result.current.openDiary('diary-6'))
    expect(result.current.openedDiary?.id).toBe('diary-6')

    archive.remove('diary-6')
    await act(() => queryClient.invalidateQueries())

    await waitFor(() => expect(result.current.openedDiaryId).toBeNull())
  })
})
