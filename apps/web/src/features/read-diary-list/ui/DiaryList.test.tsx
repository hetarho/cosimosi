import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'

import type { Diary } from '../../../entities/diary/index.ts'
import { DiaryList, type DiaryListProps } from './DiaryList.tsx'

const diary = (id: string, memberNames: readonly string[]): Diary => ({
  id,
  body: `verbatim body of ${id}`,
  diaryDate: '2026-07-01',
  createdUniverseTime: '2026-07-01',
  memories: memberNames.map((name, index) => ({
    episodicMemoryId: `${id}-m${index}`,
    name,
    mood: 'JOY',
  })),
})

function render(props: Partial<DiaryListProps>) {
  return renderToString(
    createElement(DiaryList, {
      diaries: [],
      openedDiaryId: null,
      onOpen: () => {},
      onClose: () => {},
      isLoading: false,
      isError: false,
      hasMore: false,
      isLoadingMore: false,
      onLoadMore: () => {},
      ...props,
    }),
  )
}

describe('DiaryList (web)', () => {
  beforeEach(() => setActiveLocale(defaultLocale))

  it('shows the empty keeping-place note when there are no diaries', () => {
    expect(render({})).toContain(m.diary_reader_empty())
  })

  it('renders the opened entry body verbatim with its split chips (2–5)', () => {
    const html = render({ diaries: [diary('d1', ['sea', 'cold'])], openedDiaryId: 'd1' })
    expect(html).toContain('verbatim body of d1')
    expect(html).toContain('sea')
    expect(html).toContain('cold')
  })

  it('opens an all-let-go diary with the quiet note and no chips', () => {
    const html = render({ diaries: [diary('d1', [])], openedDiaryId: 'd1' })
    expect(html).toContain(m.diary_reader_all_let_go())
  })

  it('offers the lazy load affordance only when more pages remain', () => {
    expect(render({ diaries: [diary('d1', [])], hasMore: true })).toContain(
      m.diary_reader_load_more(),
    )
    expect(render({ diaries: [diary('d1', [])], hasMore: false })).not.toContain(
      m.diary_reader_load_more(),
    )
  })
})
