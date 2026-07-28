import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, moodLabel, setActiveLocale } from '../../../shared/i18n/index.ts'

import { VALUES } from '@cosimosi/config'
import type { Diary } from '@cosimosi/memory'
import { DiaryList, type DiaryListProps } from './DiaryList.tsx'

const diary = (
  id: string,
  members: readonly { name: string; mood: string }[],
  body = `verbatim body of ${id}`,
): Diary => ({
  id,
  body,
  diaryDate: '2026-07-01',
  createdUniverseTime: '2026-07-01',
  memories: members.map((member, index) => ({
    episodicMemoryId: `${id}-m${index}`,
    name: member.name,
    mood: member.mood,
  })),
})

const joyful = (id: string, names: readonly string[]) =>
  diary(
    id,
    names.map((name) => ({ name, mood: 'JOY' })),
  )

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
      emptyState: 'archive',
      ...props,
    }),
  )
}

describe('DiaryList (web)', () => {
  beforeEach(() => setActiveLocale(defaultLocale))

  it('shows the empty keeping-place note when there are no diaries', () => {
    expect(render({})).toContain(m.diary_reader_empty())
  })

  it('distinguishes no-results from an empty archive', () => {
    const filtered = render({ emptyState: 'no-results', onClearConditions: () => {} })
    expect(filtered).toContain(m.diary_reader_no_results())
    expect(filtered).toContain(m.diary_reader_clear_conditions())
    expect(filtered).not.toContain(m.diary_reader_empty())
  })

  it('renders the opened entry body verbatim with its split chips (2–5)', () => {
    const html = render({ diaries: [joyful('d1', ['sea', 'cold'])], openedDiaryId: 'd1' })
    expect(html).toContain('verbatim body of d1')
    expect(html).toContain('sea')
    expect(html).toContain('cold')
  })

  it('opens an all-let-go diary with the quiet note and no chips', () => {
    const html = render({ diaries: [joyful('d1', [])], openedDiaryId: 'd1' })
    expect(html).toContain(m.diary_reader_all_let_go())
  })

  it('previews a bounded prefix of the body, not the whole of it ([D6])', () => {
    const body = 'ㄱ'.repeat(VALUES.diaryReader.bodyPreviewLength + 20)
    const html = render({ diaries: [diary('d1', [], body)] })
    expect(html).toContain('…')
    expect(html).not.toContain(body)
  })

  it('carries no title and no price on a closed row ([D6][D11])', () => {
    const html = render({ diaries: [joyful('d1', ['sea'])] })
    expect(html).not.toContain('title=')
    expect(html).toContain(m.diary_reader_star_count({ count: 1 }))
  })

  it('counts stars and names the distinct moods for assistive tech ([D6])', () => {
    const html = render({
      diaries: [
        diary('d1', [
          { name: 'a', mood: 'JOY' },
          { name: 'b', mood: 'JOY' },
          { name: 'c', mood: 'SAD' },
        ]),
      ],
    })
    expect(html).toContain(m.diary_reader_star_count({ count: 3 }))
    expect(html).toContain(
      m.diary_reader_mood_list({ moods: [moodLabel('JOY'), moodLabel('SAD')].join(', ') }),
    )
  })

  it('shows zero stars, no dots and no NEUTRAL colour for a memory-less diary ([I1][M3])', () => {
    const html = render({ diaries: [joyful('d1', [])] })
    expect(html).toContain(m.diary_reader_star_count({ count: 0 }))
    expect(html).not.toContain(m.diary_reader_mood_list({ moods: moodLabel('NEUTRAL') }))
  })

  it('collapses moods past the cap into a +N marker', () => {
    const moods = ['JOY', 'CALM', 'SAD', 'ANGER', 'FEAR']
    const html = render({
      diaries: [
        diary(
          'd1',
          moods.map((mood, index) => ({ name: `m${index}`, mood })),
        ),
      ],
    })
    const remainder = moods.length - VALUES.diaryReader.rowMoodDotMax
    expect(html).toContain(m.diary_reader_mood_more({ count: remainder }))
  })

  it('replaces the load-more button with the two scroll-end states ([D7])', () => {
    const loading = render({ diaries: [joyful('d1', [])], hasMore: true, isLoadingMore: true })
    expect(loading).toContain(m.diary_reader_loading_more())
    expect(loading).not.toContain(m.diary_reader_archive_end())

    const ended = render({ diaries: [joyful('d1', [])], hasMore: false })
    expect(ended).toContain(m.diary_reader_archive_end())
  })

  it('marks the keyword only through the injected body renderer ([D10])', () => {
    const html = render({
      diaries: [diary('d1', [{ name: 'sea', mood: 'JOY' }], 'coffee and rain')],
      openedDiaryId: 'd1',
      renderBodyText: (text) => `[${text}]`,
    })
    // The list hands the renderer its own body and nothing else — there is no query prop to pass on.
    expect(html).toContain('[coffee and rain]')
  })
})
