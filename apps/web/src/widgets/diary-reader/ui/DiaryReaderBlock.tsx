import { useCallback } from 'react'

import type { GetDiariesInput } from '@cosimosi/api-client'
import type { Diary } from '@cosimosi/memory'
import {
  BackIcon,
  Button,
  DeleteIcon,
  Dialog,
  IconButton,
  SegmentedControl,
  Tooltip,
} from '@cosimosi/ui'
import { useDeletionTargetStore } from '@cosimosi/universe'

import { RestoreSection } from '../../../features/restore-memory/index.ts'
import { DiaryEntry, DiaryList } from '../../../features/read-diary-list/index.ts'
import { SearchDiary } from '../../../features/search-diary/index.ts'
import { HighlightedBody } from './HighlightedBody.tsx'
import { RecallDiaryStarsAction } from '../../../features/recall-diary-stars/index.ts'
import { DiaryCalendar } from '../../../features/diary-calendar/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useDiaryArchiveNavigation, type DiaryConditionsUpdate } from '@cosimosi/universe/react'
import { useDiaryJump } from '@cosimosi/universe/react/flows'

// The archive reads immutable diaries and opens their existing memory members without a mutation.
export function DiaryReaderBlock({
  onExit,
  query,
  onQueryChange,
  view = 'list',
  onViewChange,
  month,
  onMonthChange,
}: {
  onExit: () => void
  // The archive's conditions live with this widget's host — the URL on web, screen state on mobile —
  // so a filtered archive survives a reload and Back restores the previous conditions ([D7][D8]).
  query: GetDiariesInput
  onQueryChange: (update: DiaryConditionsUpdate) => void
  // Which shape of the archive is showing, and which month the calendar is on. Both live with the host
  // for the same reason the conditions do ([D12]); `month` is absent until the reader steps a month, so
  // mounting the calendar adds no history entry.
  view?: 'list' | 'calendar'
  onViewChange: (view: 'list' | 'calendar') => void
  month?: string
  onMonthChange: (month: string) => void
}) {
  // Opened entry, conditions, calendar month, the picked day and deep-link paging are the package's
  // archive navigation; this block renders them.
  const {
    archive: { diaries, isLoading, isError, hasMore, isLoadingMore, loadMore },
    openedDiaryId,
    openedDiary,
    openDiary: setOpenedDiaryId,
    changeQuery,
    conditionsActive,
    clearConditions,
    displayedMonth,
    calendar,
    dayModalDate,
    selectDay,
    closeDay,
    dayArchive,
    moodsOpen,
    setMoodsOpen,
  } = useDiaryArchiveNavigation({ query, onQueryChange, view, month })

  const openFullDelete = useDeletionTargetStore((state) => state.openFullDelete)
  const { exit, initiateJump } = useDiaryJump({ onExit })

  const openedEntry = useCallback(
    (diary: Diary, dismiss: () => void) => (
      <div className="relative">
        <div className="absolute top-0 right-0">
          <Tooltip content={m.deletion_delete_entry_action()} align="end">
            <IconButton
              color="danger"
              size="sm"
              label={m.deletion_delete_entry_action()}
              icon={<DeleteIcon />}
              onClick={() => {
                dismiss()
                openFullDelete(diary.id)
              }}
              disabled={diary.memories.length === 0}
            />
          </Tooltip>
        </div>
        {/* Held clear of the corner control, so a long first line never runs under it. */}
        <div className="pr-10">
          <DiaryEntry
            diary={diary}
            renderBodyText={(text) => <HighlightedBody text={text} query={query.query ?? ''} />}
            actions={
              <RecallDiaryStarsAction
                liveCount={diary.memories.length}
                onInitiate={() => {
                  dismiss()
                  initiateJump(diary)
                }}
              />
            }
          />
        </div>
      </div>
    ),
    [initiateJump, openFullDelete, query.query],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* The way out is on the LEFT and the page's name is CENTRED on the line, so the title reads as
          the place rather than as the first item in a row of controls, and the door back to the
          universe sits where a reader reaches for a way back. A three-cell grid rather than
          `justify-between`: the middle cell is centred on the HEADER, so the title does not drift as
          the controls beside it change width. Which shape of the archive is showing keeps its place
          beside the title — it names what this page IS right now ([D12]).

          The way back wears no plate and no rim — a left arrow and its name, nothing else. A filled
          or bordered button there reads as an ACTION taken on this page, competing with the title it
          sits beside; going back is the room's door, and a door is not a thing to do here. Pulled
          left by its own padding so the glyph, not the padding, lines up with the content beneath. */}
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Button
          variant="text"
          color="neutral"
          size="sm"
          className="-ml-3"
          leadingIcon={<BackIcon />}
          onClick={exit}
        >
          {m.diary_reader_back()}
        </Button>
        <h1 className="text-center text-lg font-medium text-text">{m.diary_reader_title()}</h1>
        {/* `toggle`: there are exactly two shapes of the archive, so a press anywhere on the control
            lands on the other one. Aiming at the correct half — and pressing the half already held,
            which did nothing — was work this choice never needed ([D12]). */}
        <SegmentedControl
          toggle
          ariaLabel={m.calendar_view_label()}
          value={view}
          onValueChange={(next) => onViewChange(next === 'calendar' ? 'calendar' : 'list')}
          items={[
            { value: 'list', label: m.calendar_list_view_action() },
            { value: 'calendar', label: m.calendar_view_action() },
          ]}
        />
      </header>

      {/* The soft-deleted "지운 일기" restore section sits beside the immutable archive it survives
          within ([W6][D4]) — this session's releases only (an accepted v1 limit). */}
      <RestoreSection />

      {/* Every condition of the archive on one line — keyword, order, feelings, star count and the way
          back out. The ORDER steers the list, so it is withheld while the calendar shows: a control
          that moves nothing visible is noise ([D12]). */}
      <SearchDiary
        value={query}
        onChange={changeQuery}
        moodsOpen={moodsOpen}
        onMoodsOpenChange={setMoodsOpen}
        sortable={view === 'list'}
      />

      {/* Only the BODY branches: the header, the restore section, the search controls and the deep-link
          consumer effect above stay mounted across the switch, and the page-level deletion mount is
          untouched — entering the calendar drops none of them ([D12]). */}
      {view === 'calendar' ? (
        <DiaryCalendar
          month={displayedMonth}
          onMonthChange={onMonthChange}
          onSelectDay={selectDay}
          marks={calendar.marks}
          isLoading={calendar.isLoading}
          isError={calendar.isError}
        />
      ) : (
        <DiaryList
          diaries={diaries}
          openedDiaryId={openedDiaryId}
          onOpen={setOpenedDiaryId}
          isLoading={isLoading}
          isError={isError}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
          emptyState={conditionsActive ? 'no-results' : 'archive'}
          onClearConditions={conditionsActive ? clearConditions : undefined}
          scrollResetKey={JSON.stringify([
            query.query,
            query.moods,
            query.from,
            query.to,
            query.sort,
            query.minMemories,
            query.maxMemories,
          ])}
          renderBodyText={(text) => <HighlightedBody text={text} query={query.query ?? ''} />}
        />
      )}

      {/* An entry the reader opened from the list. The destructive act sits in the body's top-right
          corner rather than in the Dialog header: below `md` that header IS the sheet's grab
          surface, and a press there that becomes a downward drag would be ambiguous between
          deleting this diary and dismissing the sheet. */}
      {openedDiary && (
        <Dialog
          open
          onClose={() => setOpenedDiaryId(null)}
          title={openedDiary.diaryDate}
          closeLabel={m.common_dismiss()}
        >
          {openedEntry(openedDiary, () => setOpenedDiaryId(null))}
        </Dialog>
      )}

      {/* A day picked on the calendar, opened over it. Mounted by the WIDGET rather than handed to
          `DiaryCalendar`: the grid has no action slot by design, and this modal carries both the
          free jump and the delete ([D12] keeps the calendar itself free of either). */}
      {dayModalDate && (
        <Dialog
          open
          onClose={() => closeDay()}
          title={m.calendar_day_title({ date: dayModalDate })}
          closeLabel={m.common_dismiss()}
        >
          {dayArchive.isLoading ? (
            <p className="text-sm text-text-muted">{m.calendar_day_loading()}</p>
          ) : dayArchive.isError ? (
            <p className="text-sm text-text-muted">{m.diary_reader_error()}</p>
          ) : dayArchive.diaries.length === 0 ? (
            <p className="text-sm text-text-muted">{m.calendar_day_empty()}</p>
          ) : (
            <div className="flex flex-col gap-6">
              {dayArchive.diaries.map((diary) => (
                <div key={diary.id}>{openedEntry(diary, () => closeDay())}</div>
              ))}
            </div>
          )}
        </Dialog>
      )}
    </div>
  )
}
