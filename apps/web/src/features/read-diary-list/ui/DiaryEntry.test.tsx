import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Diary } from '@cosimosi/memory'

import { defaultLocale, m, moodLabel, setActiveLocale } from '../../../shared/i18n/index.ts'
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

// [D4][I2][D3]: an opened entry is the immutable body verbatim plus the split it produced. Reading
// it is free by construction — this takes a diary and a slot, and holds no cost, quote or spend.
describe('DiaryEntry', () => {
  beforeEach(() => setActiveLocale(defaultLocale))

  it('renders the body verbatim with its split chips (2–5)', () => {
    const html = renderToString(
      createElement(DiaryEntry, {
        diary: diary([
          { name: 'sea', mood: 'JOY' },
          { name: 'cold', mood: 'CALM' },
        ]),
      }),
    )
    expect(html).toContain('verbatim body of d1')
    expect(html).toContain('sea')
    expect(html).toContain('cold')
    expect(html).toContain(moodLabel('JOY'))
  })

  it('shows the quiet note and no chips when every memory was let go', () => {
    const html = renderToString(createElement(DiaryEntry, { diary: diary([]) }))
    expect(html).toContain(m.diary_reader_all_let_go())
  })

  it('marks the keyword only through the injected body renderer ([D10])', () => {
    const html = renderToString(
      createElement(DiaryEntry, {
        diary: diary([{ name: 'sea', mood: 'JOY' }], 'coffee and rain'),
        renderBodyText: (text: string) => `[${text}]`,
      }),
    )
    expect(html).toContain('[coffee and rain]')
  })
})
