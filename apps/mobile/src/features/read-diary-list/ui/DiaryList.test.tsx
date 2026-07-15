import { render } from '@testing-library/react-native'

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
      {...props}
    />,
  )
}

describe('DiaryList (mobile)', () => {
  beforeEach(() => setActiveLocale(defaultLocale))

  it('shows the empty keeping-place note when there are no diaries', () => {
    expect(renderList({}).getByText(m.diary_reader_empty())).toBeTruthy()
  })

  it('renders the opened entry body verbatim with its split chips', () => {
    const view = renderList({ diaries: [diary('d1', ['sea', 'cold'])], openedDiaryId: 'd1' })
    expect(view.getByText('verbatim body of d1')).toBeTruthy()
    expect(view.getByText('sea')).toBeTruthy()
    expect(view.getByText('cold')).toBeTruthy()
  })

  it('opens an all-let-go diary with the quiet note and no chips', () => {
    const view = renderList({ diaries: [diary('d1', [])], openedDiaryId: 'd1' })
    expect(view.getByText(m.diary_reader_all_let_go())).toBeTruthy()
  })
})
