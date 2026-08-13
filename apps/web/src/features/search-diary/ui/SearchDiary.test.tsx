// @vitest-environment jsdom

import { useState } from 'react'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DiarySort, type GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import type { DiaryConditionsUpdate } from '@cosimosi/universe/react'

import {
  defaultLocale,
  diaryMemoryCountLabel,
  m,
  setActiveLocale,
} from '../../../shared/i18n/index.ts'
import { SearchDiary } from './SearchDiary.tsx'

afterEach(cleanup)
beforeEach(() => setActiveLocale(defaultLocale))

// The host owns the conditions on both platforms (the URL on web), so the harness plays that part:
// it applies each update to live state, which is what makes a control's effect observable at all.
function Host({
  initial = {},
  onQuery,
  sortable,
}: {
  initial?: GetDiariesInput
  onQuery?: (query: GetDiariesInput) => void
  sortable?: boolean
}) {
  const [query, setQuery] = useState<GetDiariesInput>(initial)
  const [moodsOpen, setMoodsOpen] = useState(false)
  const change = (update: DiaryConditionsUpdate) =>
    setQuery((previous) => {
      const next = update(previous)
      onQuery?.(next)
      return next
    })
  return (
    <SearchDiary
      value={query}
      onChange={change}
      moodsOpen={moodsOpen}
      onMoodsOpenChange={setMoodsOpen}
      sortable={sortable}
    />
  )
}

// The count control names what it is about and shows what it holds, so its accessible name is the
// two together — a query by the bare label would match neither it nor the menu it opens.
const countTrigger = () =>
  screen.getByRole('button', { name: new RegExp(`^${m.diary_search_memory_count_label()}:`) })

async function chooseCount(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(countTrigger())
  await user.click(
    screen.getByRole('menuitem', {
      name: diaryMemoryCountLabel(option, VALUES.encode.maxMemories),
    }),
  )
}

describe('SearchDiary — the archive’s conditions on one line ([D8][D9])', () => {
  it('carries no card of its own, so the archive is the only framed thing on the page', () => {
    const { container } = render(<Host />)
    const section = container.querySelector('section')
    expect(section?.className).not.toMatch(/border|bg-surface/)
  })

  it('shows where the order stands and flips it on one press', async () => {
    const user = userEvent.setup()
    const seen: GetDiariesInput[] = []
    render(<Host initial={{ sort: DiarySort.NEWEST }} onQuery={(query) => seen.push(query)} />)

    // The visible word is the order the archive is IN; the accessible name is what a press does.
    const toggle = screen.getByRole('button', { name: m.diary_reader_sort_to_oldest() })
    expect(toggle.textContent).toContain(m.diary_reader_sort_newest())

    await user.click(toggle)
    expect(seen.at(-1)?.sort).toBe(DiarySort.OLDEST)
    expect(
      screen.getByRole('button', { name: m.diary_reader_sort_to_newest() }).textContent,
    ).toContain(m.diary_reader_sort_oldest())
  })

  it('withholds the order control when it would steer nothing visible', () => {
    render(<Host sortable={false} />)
    expect(screen.queryByRole('button', { name: m.diary_reader_sort_to_oldest() })).toBeNull()
    // Every other condition survives: only the ORDER belongs to the list ([D12]).
    expect(
      screen.queryByRole('button', {
        name: new RegExp(`^${m.diary_search_memory_count_label()}:`),
      }),
    ).not.toBeNull()
  })

  it('bounds the read on both sides for an exact star count', async () => {
    const user = userEvent.setup()
    const seen: GetDiariesInput[] = []
    render(<Host onQuery={(query) => seen.push(query)} />)

    await chooseCount(user, '2')
    expect(seen.at(-1)).toMatchObject({ minMemories: 2, maxMemories: 2 })
  })

  it('bounds only from below for the top choice, since a split can hold no more', async () => {
    const user = userEvent.setup()
    const seen: GetDiariesInput[] = []
    const top = VALUES.encode.maxMemories
    render(<Host onQuery={(query) => seen.push(query)} />)

    await chooseCount(user, `${String(top)}+`)
    expect(seen.at(-1)?.minMemories).toBe(top)
    expect(seen.at(-1)?.maxMemories).toBeUndefined()
  })

  it('asks for the diaries whose stars were all let go with a REAL zero bound ([I1])', async () => {
    const user = userEvent.setup()
    const seen: GetDiariesInput[] = []
    render(<Host onQuery={(query) => seen.push(query)} />)

    await chooseCount(user, '0')
    // Not "no bound": 0 is the condition, so both sides are present and both are zero.
    expect(seen.at(-1)).toMatchObject({ minMemories: 0, maxMemories: 0 })
  })

  it('offers the way out of a count condition, and clearing it drops both bounds', async () => {
    const user = userEvent.setup()
    const seen: GetDiariesInput[] = []
    render(
      <Host initial={{ minMemories: 1, maxMemories: 1 }} onQuery={(query) => seen.push(query)} />,
    )

    await user.click(screen.getByRole('button', { name: m.diary_reader_clear_conditions() }))
    expect(seen.at(-1)?.minMemories).toBeUndefined()
    expect(seen.at(-1)?.maxMemories).toBeUndefined()
  })

  it('leaves the order alone when the conditions are cleared, since it narrows nothing', async () => {
    const user = userEvent.setup()
    const seen: GetDiariesInput[] = []
    render(
      <Host
        initial={{ sort: DiarySort.OLDEST, minMemories: 1, maxMemories: 1 }}
        onQuery={(query) => seen.push(query)}
      />,
    )

    await user.click(screen.getByRole('button', { name: m.diary_reader_clear_conditions() }))
    expect(seen.at(-1)?.sort).toBe(DiarySort.OLDEST)
  })

  it('offers no way out when nothing is narrowed, whatever the order is', () => {
    render(<Host initial={{ sort: DiarySort.OLDEST }} />)
    expect(screen.queryByRole('button', { name: m.diary_reader_clear_conditions() })).toBeNull()
  })

  it('offers every count the split contract allows, each naming itself', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(countTrigger())
    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent)
    const top = VALUES.encode.maxMemories

    // all + 0…top-1 + "top and above". The control carries no visible label of its own, so each
    // choice has to say what it counts — which is what the shared projection is for.
    expect(labels).toHaveLength(top + 2)
    expect(labels[0]).toBe(diaryMemoryCountLabel('all', top))
    expect(labels.at(-1)).toBe(diaryMemoryCountLabel(`${String(top)}+`, top))
  })
})
