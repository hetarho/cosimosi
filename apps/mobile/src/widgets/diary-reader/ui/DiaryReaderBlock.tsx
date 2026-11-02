import { useCallback } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import type { GetDiariesInput } from '@cosimosi/api-client'
import type { Diary } from '@cosimosi/memory'
import { useEarnRequestStore } from '@cosimosi/twinkle'
import { Button, DeleteIcon, Dialog, IconButton, SegmentedControl, tokens } from '@cosimosi/ui'
import { useDeletionTargetStore } from '@cosimosi/universe'

import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { RestoreSection } from '../../../features/restore-memory/index.ts'
import { DiaryEntry, DiaryList } from '../../../features/read-diary-list/index.ts'
import { SearchDiary } from '../../../features/search-diary/index.ts'
import { HighlightedBody } from './HighlightedBody.tsx'
import { RecallDiaryStarsAction } from '../../../features/recall-diary-stars/index.ts'
import { SpendCostDisplay } from '../../../features/spend-cost-display/index.ts'
import { diaryRecallSpend } from '@cosimosi/twinkle'
import { DiaryCalendar } from '../../../features/diary-calendar/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast } from '@cosimosi/errors/react'
import { useDiaryArchiveNavigation, type DiaryConditionsUpdate } from '@cosimosi/universe/react'
import { useDiaryJump } from '@cosimosi/universe/react/flows'

// widgets/diary-reader (RN fork, [D2][D3]): the archive block. It composes the free read
// (read-diary-list) with the one paid action (recall-diary-stars) and owns the jump machine + the
// quote/consent sequencing: quote → consent (server sync-status, never a local Date, A1) →
// RecallDiaryStars (client operation id + explicit consent, A2/A3) → announce the acceleration, fly
// to a recovered star, invalidate the reads, hand back to the universe. Non-dismissible while
// recalling (A4) — header back / Dialog close / cancel inert — and a late completion is fenced to
// the active operation. Hardcodes no price (CC3); navigates only via the `onExit` seam. Shares
// model with the web fork.
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
  // The archive's conditions live with this widget's host — screen state here, the URL on web — so the
  // same shape drives one archive query on both platforms ([D7][D8]).
  query: GetDiariesInput
  onQueryChange: (update: DiaryConditionsUpdate) => void
  // Which shape of the archive is showing, and which month the calendar is on. Both live with the host
  // for the same reason the conditions do ([D12]); `month` is absent until the reader steps a month.
  view?: 'list' | 'calendar'
  onViewChange: (view: 'list' | 'calendar') => void
  month?: string
  onMonthChange: (month: string) => void
}) {
  const showError = useErrorToast()
  // Opened entry, conditions, calendar month, the picked day and deep-link paging are the package's
  // archive navigation; this block renders them.
  const {
    archive: { diaries, isLoading, isError, hasMore, isLoadingMore, loadMore },
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

  const invalidateBalance = useInvalidateTwinkleBalance()
  const invalidateAchievements = useInvalidateAchievements()
  const requestEarnGuide = useEarnRequestStore((state) => state.request)
  const openFullDelete = useDeletionTargetStore((state) => state.openFullDelete)
  const {
    phase,
    jumpDiaryId,
    proceedQuote,
    acceptSync,
    rejectSync,
    cancelQuote,
    exit,
    initiateJump,
  } = useDiaryJump({
    onExit,
    onError: showError,
    invalidateBalance,
    invalidateAchievements,
    requestEarnGuide,
  })

  const archiveHeader = (
    <View style={styles.listHeader}>
      <RestoreSection />
      <SearchDiary
        value={query}
        onChange={changeQuery}
        moodsOpen={moodsOpen}
        onMoodsOpenChange={setMoodsOpen}
        sortable={view === 'list'}
      />
    </View>
  )

  const openedEntry = useCallback(
    (diary: Diary, dismiss: () => void) => (
      <View style={styles.entry}>
        <View style={styles.entryCorner}>
          <IconButton
            color="danger"
            size="sm"
            label={m.deletion_delete_entry_action()}
            icon={<DeleteIcon color={tokens.color.danger} />}
            onPress={() => {
              dismiss()
              openFullDelete(diary.id)
            }}
            disabled={diary.memories.length === 0}
          />
        </View>
        <DiaryEntry
          diary={diary}
          renderBodyText={(text) => <HighlightedBody text={text} query={query.query ?? ''} />}
          actions={
            <RecallDiaryStarsAction
              liveCount={diary.memories.length}
              onInitiate={() => {
                dismiss()
                initiateJump(diary.id)
              }}
            />
          }
        />
      </View>
    ),
    [initiateJump, openFullDelete, query.query],
  )

  return (
    <View style={styles.block}>
      {/* The way out on the LEFT and the screen's name centred, mirroring the web header. Which shape
          of the archive is showing keeps its place beside the title — it names what this screen IS
          right now ([D12]). */}
      <View style={styles.header}>
        <Button color="neutral" size="sm" onPress={exit} disabled={phase === 'recalling'}>
          {m.diary_reader_back()}
        </Button>
        <Text style={styles.title}>{m.diary_reader_title()}</Text>
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
      </View>

      {view === 'calendar' ? (
        // The grid is a fixed-height month, so it scrolls with its header rather than hosting a list.
        <ScrollView>
          {archiveHeader}
          <DiaryCalendar
            month={displayedMonth}
            onMonthChange={onMonthChange}
            onSelectDay={selectDay}
            marks={calendar.marks}
            isLoading={calendar.isLoading}
            isError={calendar.isError}
          />
        </ScrollView>
      ) : (
        <DiaryList
          listHeader={archiveHeader}
          diaries={diaries}
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
          corner rather than in the Dialog header, where the close affordance already lives. */}
      {openedDiary && (
        <Dialog
          open
          onClose={() => setOpenedDiaryId(null)}
          title={openedDiary.diaryDate}
          closeLabel={m.common_dismiss()}
        >
          <ScrollView>{openedEntry(openedDiary, () => setOpenedDiaryId(null))}</ScrollView>
        </Dialog>
      )}

      {/* A day picked on the calendar, opened over it. Mounted by the WIDGET rather than handed to
          `DiaryCalendar`: the grid has no action slot by design, and this modal carries both the
          paid jump and the delete ([D12] keeps the calendar itself free of either). */}
      {dayModalDate && (
        <Dialog
          open
          onClose={() => closeDay()}
          title={m.calendar_day_title({ date: dayModalDate })}
          closeLabel={m.common_dismiss()}
        >
          {dayArchive.isLoading ? (
            <Text style={styles.muted}>{m.calendar_day_loading()}</Text>
          ) : dayArchive.isError ? (
            <Text style={styles.muted}>{m.diary_reader_error()}</Text>
          ) : dayArchive.diaries.length === 0 ? (
            <Text style={styles.muted}>{m.calendar_day_empty()}</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.dayList}>
              {dayArchive.diaries.map((diary) => (
                <View key={diary.id}>{openedEntry(diary, () => closeDay())}</View>
              ))}
            </ScrollView>
          )}
        </Dialog>
      )}

      {jumpDiaryId && phase === 'confirming' && (
        <ConfirmTimeSyncDialog open onAccept={acceptSync} onReject={rejectSync} />
      )}
      {jumpDiaryId && phase !== 'confirming' && (
        <Dialog
          open
          onClose={cancelQuote}
          title={m.diary_reader_recall_action()}
          closeLabel={m.common_dismiss()}
        >
          {phase === 'browsing' ? (
            <SpendCostDisplay
              pending={diaryRecallSpend(jumpDiaryId)}
              onProceed={proceedQuote}
              onCancel={cancelQuote}
              onEarn={requestEarnGuide}
            />
          ) : (
            <Text style={styles.muted}>{m.diary_reader_jumping()}</Text>
          )}
        </Dialog>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  listHeader: { gap: tokens.spacing[4], paddingBottom: tokens.spacing[2] },
  block: { flex: 1, gap: tokens.spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  // Centred BETWEEN the two controls rather than by a fixed measure: the title takes the middle of
  // whatever the row leaves, so neither the way out nor the view toggle pushes the name off centre.
  title: {
    color: tokens.color.text,
    flexShrink: 1,
    fontSize: tokens.fontSize['2xl'],
    fontWeight: '600',
    textAlign: 'center',
  },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  entry: { gap: tokens.spacing[2] },
  entryCorner: { alignItems: 'flex-end' },
  dayList: { gap: tokens.spacing[5] },
})
