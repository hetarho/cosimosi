import { useEffect, useRef, type ReactNode } from 'react'

import { VALUES } from '@cosimosi/config'
import { moodColor, type Mood } from '@cosimosi/emotion'
import { diaryMoods, diaryPreview, type Diary, type DiarySplitMember } from '@cosimosi/memory'
import { Button, VisuallyHidden } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface DiaryListProps {
  diaries: readonly Diary[]
  openedDiaryId: string | null
  onOpen: (diaryId: string) => void
  onClose: () => void
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
  // The opened entry's spend affordance is injected by the composing widget (the jump is a paid
  // action that this free read feature must not own); nothing renders when a diary has no live star.
  renderActions?: (diary: Diary) => ReactNode
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
  onClose,
  isLoading,
  isError,
  hasMore,
  isLoadingMore,
  onLoadMore,
  emptyState,
  onClearConditions,
  scrollResetKey,
  renderActions,
  renderBodyText,
}: DiaryListProps) {
  const openRowRef = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    if (openedDiaryId && openRowRef.current) openRowRef.current.scrollIntoView({ block: 'nearest' })
  }, [openedDiaryId])

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
      <ul className="flex flex-col gap-2">
        {diaries.map((diary) => {
          const opened = diary.id === openedDiaryId
          const preview = diaryPreview(diary.body, VALUES.diaryReader.bodyPreviewLength)
          return (
            <li
              key={diary.id}
              ref={opened ? openRowRef : null}
              className="rounded-md border border-border bg-surface"
            >
              <button
                type="button"
                aria-expanded={opened}
                onClick={() => (opened ? onClose() : onOpen(diary.id))}
                className="flex w-full flex-col items-start gap-1.5 px-4 py-3 text-left"
              >
                <time
                  dateTime={diary.diaryDate}
                  className="text-sm font-medium text-text tabular-nums"
                >
                  {diary.diaryDate}
                </time>
                {!opened && (
                  <span className="line-clamp-2 text-sm text-text-muted">
                    {renderBodyText ? renderBodyText(preview) : preview}
                  </span>
                )}
                <DiaryRowFooter memories={diary.memories} />
              </button>
              {opened && (
                <div className="flex flex-col gap-4 px-4 pb-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">
                    {renderBodyText ? renderBodyText(diary.body) : diary.body}
                  </p>
                  {diary.memories.length > 0 ? (
                    <DiaryChips members={diary.memories} />
                  ) : (
                    <p className="text-sm text-text-muted">{m.diary_reader_all_let_go()}</p>
                  )}
                  {renderActions?.(diary)}
                </div>
              )}
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

function DiaryChips({ members }: { members: readonly DiarySplitMember[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {members.map((member) => (
        <li
          key={member.episodicMemoryId}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
        >
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: moodColor(member.mood as Mood) }}
          />
          <span className="text-xs text-text" title={moodLabel(member.mood)}>
            {member.name}
          </span>
        </li>
      ))}
    </ul>
  )
}
