import { useEffect, useRef, type ReactNode } from 'react'

import { moodColor, type Mood } from '@cosimosi/emotion'
import { Button } from '@cosimosi/ui'

import type { Diary, DiarySplitMember } from '../../../entities/diary/index.ts'
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
  // The opened entry's spend affordance is injected by the composing widget (the jump is a paid
  // action that this free read feature must not own); nothing renders when a diary has no live star.
  renderActions?: (diary: Diary) => ReactNode
}

// features/read-diary-list ui ([D2]): the immutable archive, reverse-chronological. A row opens to
// the diary's verbatim body ([I2][D4]) and its split membership as mood-colored chips ([D3]); an
// all-let-go diary opens with no chips and a quiet note. Reading opens/reads freely — this surface
// spends nothing and moves no clock.
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
  renderActions,
}: DiaryListProps) {
  const openRowRef = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    if (openedDiaryId && openRowRef.current) openRowRef.current.scrollIntoView({ block: 'nearest' })
  }, [openedDiaryId])

  if (isLoading) {
    return <p className="p-6 text-sm text-text-muted">{m.diary_reader_loading()}</p>
  }
  if (isError) {
    return <p className="p-6 text-sm text-text-muted">{m.diary_reader_error()}</p>
  }
  if (diaries.length === 0) {
    return <p className="p-6 text-sm text-text-muted">{m.diary_reader_empty()}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {diaries.map((diary) => {
          const opened = diary.id === openedDiaryId
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
                className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left"
              >
                <span className="text-sm font-medium text-text tabular-nums">
                  {diary.diaryDate}
                </span>
                {!opened && (
                  <span className="line-clamp-1 text-sm text-text-muted">{diary.body}</span>
                )}
              </button>
              {opened && (
                <div className="flex flex-col gap-4 px-4 pb-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">
                    {diary.body}
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
      {hasMore && (
        <div className="flex justify-center pb-2">
          <Button color="neutral" size="sm" onClick={onLoadMore} disabled={isLoadingMore}>
            {m.diary_reader_load_more()}
          </Button>
        </div>
      )}
    </div>
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
