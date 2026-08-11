import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { defaultRangeExtractor, useWindowVirtualizer } from '@tanstack/react-virtual'

import { VALUES } from '@cosimosi/config'
import { moodColor } from '@cosimosi/emotion'
import { diaryMoods, diaryPreview, type Diary, type DiarySplitMember } from '@cosimosi/memory'
import { Button, VisuallyHidden } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface DiaryListProps {
  diaries: readonly Diary[]
  /** Which entry the reader has open. The row itself never expands — this is what the virtualizer
   *  scrolls to, so a deep-linked entry sits under its own modal and dismissing it lands there. */
  openedDiaryId: string | null
  onOpen: (diaryId: string) => void
  isLoading: boolean
  isError: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  // Which nothing-to-show this is. Only the composing widget knows whether conditions are active, and
  // it tells the list in two words rather than handing over the conditions themselves ([D10]).
  emptyState: 'archive' | 'no-results'
  onClearConditions?: () => void
  // Changes whenever the archive's conditions do. A fresh keyset page starts at the top, so the
  // reader should be looking there rather than mid-way down the previous result set ([D7]).
  scrollResetKey?: string
  // Renders a stretch of the diary's own body — the seam the search feature marks its hits through.
  // The list never sees the keyword, so no query can reach a memory's text ([D10]).
  renderBodyText?: (text: string) => ReactNode
}

// features/read-diary-list ui ([D2][D6][D7]): the immutable archive. A closed row is date + a bounded
// preview of the verbatim body + the count of stars born from it + its distinct mood dots — no title
// exists at any layer. A row opens to the whole body ([I2][D4]) and its split membership as
// mood-colored chips ([D3]). Reading, previewing and scrolling are free: this surface spends nothing
// and moves no clock ([D11][T3]).
export function DiaryList({
  diaries,
  openedDiaryId,
  onOpen,
  isLoading,
  isError,
  hasMore,
  isLoadingMore,
  onLoadMore,
  emptyState,
  onClearConditions,
  scrollResetKey,
  renderBodyText,
}: DiaryListProps) {
  // Where the list begins in the document. Rows are positioned relative to the list, so this never
  // moves them — it is what tells the virtualizer which slice of the archive the page's scroll
  // offset is currently over. Held as the NODE rather than a ref, because the list is not mounted on
  // the first render (the archive loads first) and the measurement has to start when it appears.
  const [listNode, setListNode] = useState<HTMLUListElement | null>(null)
  const [listOffset, setListOffset] = useState(0)
  useLayoutEffect(() => {
    if (!listNode || typeof ResizeObserver === 'undefined') return
    const sync = () => {
      const next = Math.round(listNode.getBoundingClientRect().top + window.scrollY)
      setListOffset((current) => (current === next ? current : next))
    }
    sync()
    // Everything above the list moves it and re-renders none of this: the restore section mounts
    // when a diary is released, the search controls wrap, the viewport resizes. Each of those
    // changes the height of the document's own box, which is what is watched here.
    const observer = new ResizeObserver(sync)
    observer.observe(document.documentElement)
    observer.observe(document.body)
    window.addEventListener('resize', sync)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [listNode])

  // A row the reader has focused — or whose entry is open — stays mounted after it scrolls out of
  // the window. Unmounting either drops keyboard focus to the document body: mid-scroll for the
  // focused one, and on dismissal for the opened one, since the surface holding the entry restores
  // focus to the row that opened it and the page behind that surface still scrolls.
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const openedIndex = openedDiaryId ? diaries.findIndex((diary) => diary.id === openedDiaryId) : -1
  const keepFocusedRow = useCallback(
    (range: Parameters<typeof defaultRangeExtractor>[0]) => {
      const visible = defaultRangeExtractor(range)
      const pinned = [focusedIndex, openedIndex].filter(
        (index): index is number =>
          index !== null && index >= 0 && index < range.count && !visible.includes(index),
      )
      return pinned.length === 0 ? visible : [...visible, ...pinned].sort((a, b) => a - b)
    },
    [focusedIndex, openedIndex],
  )

  // Keyed by the diary, not by position, so a row that has been measured keeps its real height if
  // the archive is re-sorted under it.
  const itemKey = useCallback((index: number) => diaries[index]?.id ?? index, [diaries])
  const virtualizer = useWindowVirtualizer({
    count: diaries.length,
    estimateSize: () => VALUES.diaryReader.rowEstimateHeightPx,
    overscan: VALUES.diaryReader.rowOverscan,
    gap: VALUES.diaryReader.rowGapPx,
    scrollMargin: listOffset,
    getItemKey: itemKey,
    rangeExtractor: keepFocusedRow,
  })

  // The deep link from a star's detail panel can open a row well outside the mounted window, so the
  // scroll is asked of the virtualizer by index rather than of a node that may not exist. `auto`
  // moves only when the row is not already in view. `listOffset` is a dependency because the first
  // measured offset lands a commit after the list mounts: a deep link that resolved before it would
  // otherwise scroll to a target computed from offset 0.
  useEffect(() => {
    if (openedIndex < 0) return
    virtualizer.scrollToIndex(openedIndex, { align: 'auto' })
  }, [openedIndex, listOffset, virtualizer])

  const lastResetKey = useRef(scrollResetKey)
  useEffect(() => {
    // Arriving is not a condition change: only a later key resets the scroll, so a deep-linked row
    // that just scrolled itself into view is not yanked back to the top.
    if (lastResetKey.current === scrollResetKey) return
    lastResetKey.current = scrollResetKey
    window.scrollTo({ top: 0 })
  }, [scrollResetKey])

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  // No observer exists while a page is in flight, so the sentinel cannot ask twice; when the fetch
  // settles a fresh observer is attached and fires straight away if the sentinel is still in view,
  // which is what keeps a short page from stalling the scroll.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || isLoadingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      { rootMargin: `${VALUES.diaryReader.infiniteScrollRootMarginPx}px` },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, onLoadMore])

  if (isLoading) {
    return <p className="p-6 text-sm text-text-muted">{m.diary_reader_loading()}</p>
  }
  if (isError) {
    return <p className="p-6 text-sm text-text-muted">{m.diary_reader_error()}</p>
  }
  if (diaries.length === 0) {
    // An empty archive and a filtered-to-nothing archive are different facts and read differently.
    return emptyState === 'no-results' ? (
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="text-sm text-text-muted">{m.diary_reader_no_results()}</p>
        {onClearConditions && (
          <Button color="neutral" size="sm" onClick={onClearConditions}>
            {m.diary_reader_clear_conditions()}
          </Button>
        )}
      </div>
    ) : (
      <p className="p-6 text-sm text-text-muted">{m.diary_reader_empty()}</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Only the rows over the viewport (plus the overscan) are mounted, so the DOM stays a
          screenful whatever the archive's length. The <ul> holds the full scroll height and each row
          is placed inside it; the sentinel below therefore still sits at the true end of the list. */}
      <ul ref={setListNode} className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const diary = diaries[row.index]
          if (!diary) return null
          const preview = diaryPreview(diary.body, VALUES.diaryReader.bodyPreviewLength)
          return (
            <li
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full rounded-md border border-border bg-surface"
              style={{ transform: `translateY(${row.start - listOffset}px)` }}
            >
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => onOpen(diary.id)}
                onFocus={() => setFocusedIndex(row.index)}
                onBlur={() =>
                  setFocusedIndex((current) => (current === row.index ? null : current))
                }
                className="flex w-full flex-col items-start gap-1.5 px-4 py-3 text-left"
              >
                <time
                  dateTime={diary.diaryDate}
                  className="text-sm font-medium text-text tabular-nums"
                >
                  {diary.diaryDate}
                </time>
                <span className="line-clamp-2 text-sm text-text-muted">
                  {renderBodyText ? renderBodyText(preview) : preview}
                </span>
                <DiaryRowFooter memories={diary.memories} />
              </button>
            </li>
          )
        })}
      </ul>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {isLoadingMore && (
        <p role="status" className="pb-2 text-center text-sm text-text-muted">
          {m.diary_reader_loading_more()}
        </p>
      )}
      {!hasMore && !isLoadingMore && (
        <p className="pb-2 text-center text-sm text-text-subtle">{m.diary_reader_archive_end()}</p>
      )}
    </div>
  )
}

// The row's recognition line: how many stars this entry launched, and which feelings they carry.
function DiaryRowFooter({ memories }: { memories: readonly DiarySplitMember[] }) {
  const moods = diaryMoods(memories)
  const shown = moods.slice(0, VALUES.diaryReader.rowMoodDotMax)
  const remainder = moods.length - shown.length
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-text-subtle tabular-nums">
        {m.diary_reader_star_count({ count: memories.length })}
      </span>
      {moods.length > 0 && (
        <>
          <span className="flex items-center gap-1">
            {shown.map((mood) => (
              <span
                key={mood}
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: moodColor(mood) }}
              />
            ))}
            {remainder > 0 && (
              <span aria-hidden className="text-xs text-text-subtle">
                {m.diary_reader_mood_more({ count: remainder })}
              </span>
            )}
          </span>
          <VisuallyHidden>
            {m.diary_reader_mood_list({ moods: moods.map(moodLabel).join(', ') })}
          </VisuallyHidden>
        </>
      )}
    </span>
  )
}
