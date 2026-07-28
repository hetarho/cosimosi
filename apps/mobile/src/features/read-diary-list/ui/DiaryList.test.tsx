import { render } from '@testing-library/react-native'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import { moodLabel } from '@cosimosi/emotion/i18n'

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

function renderList(props: Partial<DiaryListProps>) {
  return render(
    <DiaryList
      diaries={[]}
      openedDiaryId={null}
      onOpen={() => {}}
      onClose={() => {}}
      isLoading={false}
      isError={false}
      hasMore={false}
      isLoadingMore={false}
      onLoadMore={() => {}}
      emptyState="archive"
      {...props}
    />,
  )
}

describe('DiaryList (mobile)', () => {
  beforeEach(() => setActiveLocale(defaultLocale))

  it('shows the empty keeping-place note when there are no diaries', () => {
    expect(renderList({}).getByText(m.diary_reader_empty())).toBeTruthy()
  })

  it('distinguishes no-results from an empty archive', () => {
    const view = renderList({ emptyState: 'no-results', onClearConditions: () => {} })
    expect(view.getByText(m.diary_reader_no_results())).toBeTruthy()
    expect(view.getByText(m.diary_reader_clear_conditions())).toBeTruthy()
    expect(view.queryByText(m.diary_reader_empty())).toBeNull()
  })

  it('renders the opened entry body verbatim with its split chips', () => {
    const view = renderList({ diaries: [joyful('d1', ['sea', 'cold'])], openedDiaryId: 'd1' })
    expect(view.getByText('verbatim body of d1')).toBeTruthy()
    expect(view.getByText('sea')).toBeTruthy()
    expect(view.getByText('cold')).toBeTruthy()
  })

  it('opens an all-let-go diary with the quiet note and no chips', () => {
    const view = renderList({ diaries: [joyful('d1', [])], openedDiaryId: 'd1' })
    expect(view.getByText(m.diary_reader_all_let_go())).toBeTruthy()
  })

  it('previews a bounded prefix of the body, not the whole of it ([D6])', () => {
    const body = 'ㄱ'.repeat(VALUES.diaryReader.bodyPreviewLength + 20)
    const view = renderList({ diaries: [diary('d1', [], body)] })
    expect(view.queryByText(body)).toBeNull()
    expect(view.getByText(`${'ㄱ'.repeat(VALUES.diaryReader.bodyPreviewLength)}…`)).toBeTruthy()
  })

  it('counts stars and names the distinct moods for assistive tech ([D6])', () => {
    const view = renderList({
      diaries: [
        diary('d1', [
          { name: 'a', mood: 'JOY' },
          { name: 'b', mood: 'JOY' },
          { name: 'c', mood: 'SAD' },
        ]),
      ],
    })
    expect(view.getByText(m.diary_reader_star_count({ count: 3 }))).toBeTruthy()
    // One announced element carries both facts, so a reader hears the count AND the feelings; the
    // colour swatches beside them are decorative.
    expect(
      view.getByLabelText(
        `${m.diary_reader_star_count({ count: 3 })}. ${m.diary_reader_mood_list({
          moods: [moodLabel('JOY'), moodLabel('SAD')].join(', '),
        })}`,
      ),
    ).toBeTruthy()
  })

  it('shows zero stars for a memory-less diary and names no mood ([I1][M3])', () => {
    const view = renderList({ diaries: [joyful('d1', [])] })
    expect(view.getByText(m.diary_reader_star_count({ count: 0 }))).toBeTruthy()
    expect(
      view.queryByLabelText(new RegExp(m.diary_reader_mood_list({ moods: moodLabel('NEUTRAL') }))),
    ).toBeNull()
  })

  it('collapses moods past the cap into a +N marker', () => {
    const moods = ['JOY', 'CALM', 'SAD', 'ANGER', 'FEAR']
    const view = renderList({
      diaries: [
        diary(
          'd1',
          moods.map((mood, index) => ({ name: `m${index}`, mood })),
        ),
      ],
    })
    const remainder = moods.length - VALUES.diaryReader.rowMoodDotMax
    expect(view.getByText(m.diary_reader_mood_more({ count: remainder }))).toBeTruthy()
  })

  it('marks the keyword only through the injected body renderer ([D10])', () => {
    const view = renderList({
      diaries: [diary('d1', [{ name: 'sea', mood: 'JOY' }], 'coffee and rain')],
      openedDiaryId: 'd1',
      renderBodyText: (text) => `[${text}]`,
    })
    // The list hands the renderer its own body and nothing else — there is no query prop to pass on.
    expect(view.getByText('[coffee and rain]')).toBeTruthy()
  })

  it('replaces the load-more button with the two scroll-end states ([D7])', () => {
    const loading = renderList({
      diaries: [joyful('d1', [])],
      hasMore: true,
      isLoadingMore: true,
    })
    expect(loading.getByText(m.diary_reader_loading_more())).toBeTruthy()

    const ended = renderList({ diaries: [joyful('d1', [])], hasMore: false })
    expect(ended.getByText(m.diary_reader_archive_end())).toBeTruthy()
  })
})
