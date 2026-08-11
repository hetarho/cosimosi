import { render } from '@testing-library/react-native'

import type { Diary } from '@cosimosi/memory'
import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { DiaryEntry } from './DiaryEntry.tsx'

const diary = (
  members: readonly { name: string; mood: string }[],
  body = 'verbatim body of d1',
): Diary => ({
  id: 'd1',
  body,
  diaryDate: '2026-07-01',
  createdUniverseTime: '2026-07-01',
  memories: members.map((member, index) => ({
    episodicMemoryId: `d1-m${index}`,
    name: member.name,
    mood: member.mood,
  })),
})

// [D4][I2][D3], RN fork: an opened entry is the immutable body verbatim plus the split it produced.
describe('DiaryEntry (mobile)', () => {
  beforeEach(() => setActiveLocale(defaultLocale))

  it('renders the body verbatim with its split chips (2–5)', () => {
    const view = render(
      <DiaryEntry
        diary={diary([
          { name: 'sea', mood: 'JOY' },
          { name: 'cold', mood: 'CALM' },
        ])}
      />,
    )
    expect(view.getByText('verbatim body of d1')).toBeTruthy()
    expect(view.getByText('sea')).toBeTruthy()
    expect(view.getByText('cold')).toBeTruthy()
  })

  it('shows the quiet note and no chips when every memory was let go', () => {
    const view = render(<DiaryEntry diary={diary([])} />)
    expect(view.getByText(m.diary_reader_all_let_go())).toBeTruthy()
  })

  it('marks the keyword only through the injected body renderer ([D10])', () => {
    const view = render(
      <DiaryEntry
        diary={diary([{ name: 'sea', mood: 'JOY' }], 'coffee and rain')}
        renderBodyText={(text) => `[${text}]`}
      />,
    )
    expect(view.getByText('[coffee and rain]')).toBeTruthy()
  })
})
