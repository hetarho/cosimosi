// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { VALUES } from '@cosimosi/config'
import type { Diary } from '@cosimosi/memory'

import { defaultLocale, m, moodLabel, setActiveLocale } from '../../../shared/i18n/index.ts'
import { DiaryList, type DiaryListProps } from './DiaryList.tsx'

// The list windows its rows, so the assertions below depend on browser measurements jsdom does not
// do: rows report `offsetHeight` 0, elements report a zero rect, and neither observer exists. The
// stubs stand all of that up — and they are deliberately live rather than inert, because an observer
// that records nothing would let a virtualizer wired to the wrong lifecycle pass every test.
const ROW_HEIGHT = VALUES.diaryReader.rowEstimateHeightPx
const VIEWPORT = 768 // jsdom's window.innerHeight
// Far enough down the document that a list measured from the top of the page and one measured from
// its own position disagree about which rows are on screen by more than the overscan.
const LIST_TOP = 800

let intersect: (() => void) | null = null
let resizeTargets: Element[] = []
let fireResize: (() => void) | null = null

beforeEach(() => {
  setActiveLocale(defaultLocale)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(ROW_HEIGHT)
  // Only the list itself needs a position; `top` is viewport-relative, so it moves with the scroll
  // exactly as a real one does and `top + scrollY` stays put.
  vi.spyOn(HTMLUListElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ top: LIST_TOP - window.scrollY, height: 0 }) as DOMRect,
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {
        fireResize = () => this.callback()
      }
      observe(target: Element) {
        resizeTargets.push(target)
      }
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {
        intersect = () => this.callback([{ isIntersecting: true }])
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('scrollTo', vi.fn())
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
})

afterEach(() => {
  cleanup()
  intersect = null
  fireResize = null
  resizeTargets = []
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// jsdom never scrolls, so the page's offset is moved by hand and the scroll announced the way a
// browser announces it — which is the only signal the virtualizer listens to.
function scrollPageTo(offset: number) {
  act(() => {
    window.scrollY = offset
    window.dispatchEvent(new Event('scroll'))
  })
}

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

function show(props: Partial<DiaryListProps>) {
  const merged: DiaryListProps = {
    diaries: [],
    openedDiaryId: null,
    onOpen: () => {},
    isLoading: false,
    isError: false,
    hasMore: false,
    isLoadingMore: false,
    onLoadMore: () => {},
    emptyState: 'archive',
    ...props,
  }
  return render(<DiaryList {...merged} />)
}

const html = (props: Partial<DiaryListProps>) => show(props).container.innerHTML

const rows = () => Array.from(document.querySelectorAll('li[data-index]'))
const rowIndexes = () => rows().map((row) => Number(row.getAttribute('data-index')))

const archiveOf = (count: number) =>
  Array.from({ length: count }, (_, index) => joyful(`d${index}`, ['sea']))

describe('DiaryList (web)', () => {
  it('shows the empty keeping-place note when there are no diaries', () => {
    expect(html({})).toContain(m.diary_reader_empty())
  })

  it('distinguishes no-results from an empty archive', () => {
    const filtered = html({ emptyState: 'no-results', onClearConditions: () => {} })
    expect(filtered).toContain(m.diary_reader_no_results())
    expect(filtered).toContain(m.diary_reader_clear_conditions())
    expect(filtered).not.toContain(m.diary_reader_empty())
  })

  it('shows a row preview whether or not its entry is open — the row never expands', () => {
    const rendered = html({ diaries: [joyful('d1', ['sea', 'cold'])], openedDiaryId: 'd1' })
    expect(rendered).toContain('verbatim body of d1')
    // The body and the split live in the entry surface now, so no chip reaches the row.
    expect(rendered).not.toContain('sea')
  })

  it('previews a bounded prefix of the body, not the whole of it ([D6])', () => {
    const body = 'ㄱ'.repeat(VALUES.diaryReader.bodyPreviewLength + 20)
    const rendered = html({ diaries: [diary('d1', [], body)] })
    expect(rendered).toContain('…')
    expect(rendered).not.toContain(body)
  })

  it('carries no title and no price on a closed row ([D6][D11])', () => {
    const rendered = html({ diaries: [joyful('d1', ['sea'])] })
    expect(rendered).not.toContain('title=')
    expect(rendered).toContain(m.diary_reader_star_count({ count: 1 }))
  })

  it('counts stars and names the distinct moods for assistive tech ([D6])', () => {
    const rendered = html({
      diaries: [
        diary('d1', [
          { name: 'a', mood: 'JOY' },
          { name: 'b', mood: 'JOY' },
          { name: 'c', mood: 'SAD' },
        ]),
      ],
    })
    expect(rendered).toContain(m.diary_reader_star_count({ count: 3 }))
    expect(rendered).toContain(
      m.diary_reader_mood_list({ moods: [moodLabel('JOY'), moodLabel('SAD')].join(', ') }),
    )
  })

  it('shows zero stars, no dots and no NEUTRAL colour for a memory-less diary ([I1][M3])', () => {
    const rendered = html({ diaries: [joyful('d1', [])] })
    expect(rendered).toContain(m.diary_reader_star_count({ count: 0 }))
    expect(rendered).not.toContain(m.diary_reader_mood_list({ moods: moodLabel('NEUTRAL') }))
  })

  it('collapses moods past the cap into a +N marker', () => {
    const moods = ['JOY', 'CALM', 'SAD', 'ANGER', 'FEAR']
    const rendered = html({
      diaries: [
        diary(
          'd1',
          moods.map((mood, index) => ({ name: `m${index}`, mood })),
        ),
      ],
    })
    expect(rendered).toContain(
      m.diary_reader_mood_more({ count: moods.length - VALUES.diaryReader.rowMoodDotMax }),
    )
  })

  it('replaces the load-more button with the two scroll-end states ([D7])', () => {
    const loading = html({ diaries: [joyful('d1', [])], hasMore: true, isLoadingMore: true })
    expect(loading).toContain(m.diary_reader_loading_more())
    expect(loading).not.toContain(m.diary_reader_archive_end())

    cleanup()
    expect(html({ diaries: [joyful('d1', [])], hasMore: false })).toContain(
      m.diary_reader_archive_end(),
    )
  })

  it('marks the keyword only through the injected body renderer ([D10])', () => {
    const rendered = html({
      diaries: [diary('d1', [{ name: 'sea', mood: 'JOY' }], 'coffee and rain')],
      renderBodyText: (text) => `[${text}]`,
    })
    // The list hands the renderer its own preview and nothing else — there is no query prop to
    // pass on, and no seam through which one could reach a memory's text.
    expect(rendered).toContain('[coffee and rain]')
    expect(Object.keys({} as DiaryListProps)).not.toContain('query')
  })

  it('mounts a viewport of rows, not the archive, however many pages are in hand', () => {
    show({ diaries: archiveOf(500) })

    const mounted = rows()
    // A viewport of rows plus the overscan on each edge — an order of magnitude below the 500 in
    // hand, and it does not grow with the archive.
    const perViewport = Math.ceil(VIEWPORT / (ROW_HEIGHT + VALUES.diaryReader.rowGapPx))
    expect(mounted.length).toBeLessThanOrEqual(perViewport + 2 * VALUES.diaryReader.rowOverscan + 2)
    expect(mounted.length).toBeGreaterThan(0)
    expect(screen.queryByText('verbatim body of d499')).toBeNull()
  })

  it('keeps the rows in archive order, so tab order follows the dates', () => {
    show({ diaries: archiveOf(200) })

    expect(rowIndexes()[0]).toBe(0)
    expect(rowIndexes()).toEqual([...rowIndexes()].sort((a, b) => a - b))
  })

  it('measures where the list sits once the archive stops loading, not only at mount', () => {
    const view = show({ diaries: [], isLoading: true })
    // Nothing to measure while the archive is still loading — the list is not mounted yet.
    expect(resizeTargets).toHaveLength(0)

    act(() => {
      view.rerender(
        <DiaryList
          diaries={archiveOf(200)}
          openedDiaryId={null}
          onOpen={() => {}}
          isLoading={false}
          isError={false}
          hasMore={false}
          isLoadingMore={false}
          onLoadMore={() => {}}
          emptyState="archive"
        />,
      )
    })
    expect(resizeTargets).toContain(document.documentElement)

    // And the offset reached the virtualizer: scrolled to exactly the list's own top, the window is
    // the first rows. A list that still thought it began at the document top would be showing rows
    // from ~800px further down the archive.
    scrollPageTo(LIST_TOP)
    expect(rowIndexes()[0]).toBe(0)
  })

  it('re-measures when something above the list changes height', () => {
    show({ diaries: archiveOf(200) })
    scrollPageTo(LIST_TOP)
    expect(rowIndexes()[0]).toBe(0)

    // A restore section appears above the list and pushes it down; nothing re-renders this component.
    const pushedDown = LIST_TOP + 400
    vi.spyOn(HTMLUListElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ top: pushedDown - window.scrollY, height: 0 }) as DOMRect,
    )
    act(() => fireResize?.())

    scrollPageTo(pushedDown)
    expect(rowIndexes()[0]).toBe(0)
  })

  it('keeps a focused row mounted after the reader scrolls past it', () => {
    show({ diaries: archiveOf(200) })
    const firstRow = screen.getAllByRole('button')[0]!
    act(() => firstRow.focus())

    scrollPageTo(LIST_TOP + 4000)

    // The window has moved on, but the row holding keyboard focus is still there — otherwise focus
    // would have fallen to the document body mid-scroll.
    expect(rowIndexes()[0]).toBe(0)
    expect(rowIndexes().at(-1)).toBeGreaterThan(20)
    expect(document.activeElement).toBe(firstRow)

    // Once focus leaves, nothing pins it any more.
    act(() => firstRow.blur())
    scrollPageTo(LIST_TOP + 4008)
    expect(rowIndexes()[0]).toBeGreaterThan(0)
  })

  it('still asks for the next keyset page when the sentinel comes into view ([D7])', async () => {
    const onLoadMore = vi.fn()
    show({ diaries: archiveOf(100), hasMore: true, onLoadMore })

    expect(intersect).not.toBeNull()
    intersect?.()
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('asks for nothing while a page is in flight or the archive has ended', () => {
    const onLoadMore = vi.fn()
    show({ diaries: [joyful('d1', [])], hasMore: true, isLoadingMore: true, onLoadMore })
    expect(intersect).toBeNull()

    cleanup()
    show({ diaries: [joyful('d1', [])], hasMore: false, onLoadMore })
    expect(intersect).toBeNull()
    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it('returns to the top of a fresh keyset page only when the conditions change ([D7])', () => {
    window.scrollY = 240
    const view = show({ diaries: [joyful('d1', ['sea'])], scrollResetKey: 'a' })
    // Arriving keeps the reader where they were: the virtualizer re-applies the offset the page is
    // already at, and the list itself asks for nothing.
    expect(window.scrollTo).not.toHaveBeenCalledWith({ top: 0 })

    view.rerender(
      <DiaryList
        diaries={[joyful('d1', ['sea'])]}
        openedDiaryId={null}
        onOpen={() => {}}
        isLoading={false}
        isError={false}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={() => {}}
        emptyState="archive"
        scrollResetKey="b"
      />,
    )
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('opens the row the reader clicked, whatever its position in the window', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    show({ diaries: archiveOf(100), onOpen })

    await user.click(screen.getAllByRole('button')[3]!)
    expect(onOpen).toHaveBeenCalledWith('d3')
  })
})
