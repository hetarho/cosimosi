import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createSyncStatusQueryKey,
  createSyncStatusQueryOptions,
  DiarySort,
  type GetDiariesInput,
} from '@cosimosi/api-client'
import { classifyErrorRecovery } from '@cosimosi/errors'
import { useEarnRequestStore } from '@cosimosi/twinkle'
import { Button, Dialog, SegmentedControl, tokens } from '@cosimosi/ui'
import {
  classifyPaidActionError,
  createPaidActionSession,
  diaryReaderMachine,
  diaryRecallAdvanceAnnouncement,
  requestRecallDiaryStars,
  resolveCalendarMonth,
  useDeletionTargetStore,
  useOpenDiaryTargetStore,
  usePendingFlyTargetStore,
  type DiaryReaderPhase,
  type PaidActionAttempt,
  type PaidActionSession,
} from '@cosimosi/universe'

import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { useAdvanceAnnouncementStore } from '../../../features/accelerate-time/index.ts'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { RestoreSection } from '../../../features/restore-memory/index.ts'
import { DiaryList, useDiaryArchive } from '../../../features/read-diary-list/index.ts'
import { HighlightedBody, SearchDiary } from '../../../features/search-diary/index.ts'
import { RecallDiaryStarsAction } from '../../../features/recall-diary-stars/index.ts'
import { SpendCostDisplay, diaryRecallSpend } from '../../../features/spend-cost-display/index.ts'
import { DiaryCalendar, useDiaryCalendar } from '../../../features/diary-calendar/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast, useMachine } from '../../../shared/model/index.ts'
import { useInvalidateUniverse, type DiaryConditionsUpdate } from '@cosimosi/universe/react'

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
  const { diaries, isLoading, isError, hasMore, isLoadingMore, loadMore } = useDiaryArchive(query)
  const [openedDiaryId, setOpenedDiaryId] = useState<string | null>(null)
  const [jumpDiaryId, setJumpDiaryId] = useState<string | null>(null)
  const sessionRef = useRef<PaidActionSession | null>(null)
  if (sessionRef.current === null) sessionRef.current = createPaidActionSession()
  const paidSession = sessionRef.current
  const [attempt, setAttempt] = useState<PaidActionAttempt | null>(null)

  // Any condition change starts a fresh keyset page, so the opened entry may not be in the new result
  // set and the reader should be looking at the top of it ([D7]).
  const changeQuery = useCallback(
    (update: DiaryConditionsUpdate) => {
      setOpenedDiaryId(null)
      onQueryChange(update)
    },
    [onQueryChange],
  )

  const conditionsActive =
    (query.query ?? '') !== '' ||
    (query.moods ?? []).length > 0 ||
    (query.from ?? '') !== '' ||
    (query.to ?? '') !== ''

  const clearConditions = useCallback(() => {
    changeQuery((previous) => ({ ...previous, query: '', moods: [], from: '', to: '' }))
  }, [changeQuery])

  // The month is RESOLVED rather than stored, from the archive page the list has already fetched ([D12]).
  const displayedMonth = resolveCalendarMonth(
    month,
    diaries.map((diary) => diary.diaryDate),
    new Date(),
  )
  const calendar = useDiaryCalendar(displayedMonth, view === 'calendar')

  // Selecting a day narrows the archive to exactly that day and shows the list, so a day holding several
  // diaries lands on all of them rather than on a guessed single entry ([D12][D8]).
  const selectDay = useCallback(
    (date: string) => {
      changeQuery((previous) => ({ ...previous, from: date, to: date }))
      onViewChange('list')
    },
    [changeQuery, onViewChange],
  )

  const [snapshot, send] = useMachine(diaryReaderMachine)
  const phase = snapshot.value as DiaryReaderPhase

  const transport = useTransport()
  const queryClient = useQueryClient()
  const announceAdvance = useAdvanceAnnouncementStore((state) => state.announce)
  const requestFlyTarget = usePendingFlyTargetStore((state) => state.request)
  const requestEarnGuide = useEarnRequestStore((state) => state.request)
  const openFullDelete = useDeletionTargetStore((state) => state.openFullDelete)
  const invalidateBalance = useInvalidateTwinkleBalance()
  // Every action that can record progress refreshes the achievement read on resolution, which is
  // also what feeds the unlock notice's diff — there is no push and no polling anywhere.
  const invalidateAchievements = useInvalidateAchievements()
  const invalidateUniverse = useInvalidateUniverse()

  const syncStatusQuery = useQuery(createSyncStatusQueryOptions(transport))

  useEffect(() => {
    if (syncStatusQuery.error) showError(syncStatusQuery.error)
  }, [syncStatusQuery.error, showError])

  useEffect(() => () => paidSession.invalidate(), [paidSession])

  const invalidateSyncStatus = useCallback(() => {
    queryClient
      .invalidateQueries({ queryKey: createSyncStatusQueryKey(transport) })
      .catch(() => undefined)
  }, [queryClient, transport])

  const deepLinkMemoryId = useOpenDiaryTargetStore((state) => state.memoryId)
  const clearDeepLink = useOpenDiaryTargetStore((state) => state.clear)
  useEffect(() => {
    if (!deepLinkMemoryId) return
    const match = diaries.find((diary) =>
      diary.memories.some((member) => member.episodicMemoryId === deepLinkMemoryId),
    )
    if (match) {
      setOpenedDiaryId(match.id)
      clearDeepLink()
      return
    }
    // The archive the star's diary must be found in is the whole archive: paging a filtered one would
    // run out of pages and drop the request, so the conditions are lifted first and the search then
    // continues over every entry.
    if (conditionsActive) {
      clearConditions()
      return
    }
    if (hasMore && !isLoadingMore) loadMore()
    else if (!hasMore) clearDeepLink()
  }, [
    deepLinkMemoryId,
    diaries,
    hasMore,
    isLoadingMore,
    loadMore,
    clearDeepLink,
    conditionsActive,
    clearConditions,
  ])

  const runRecall = useCallback(
    async (diaryId: string, consent: boolean) => {
      if (!attempt || attempt.targetKey !== diaryId || !paidSession.start(attempt)) return
      const activeAttempt = attempt
      const issue = () =>
        requestRecallDiaryStars(transport, {
          diaryId,
          operationId: activeAttempt.operationId,
          syncConsent: consent,
        })
      try {
        let response
        try {
          response = await issue()
        } catch (firstError) {
          if (!paidSession.isActive(activeAttempt)) return
          if (classifyPaidActionError(firstError) !== 'ambiguous') throw firstError
          // Ambiguous — re-issue ONCE with the SAME operation id: a committed-but-lost jump replays
          // its receipt (no second spend, no re-quote of a depleted balance, A2/A5); otherwise it
          // does the work. A second ambiguous failure falls through to the outer catch.
          response = await issue()
        }
        if (!paidSession.isActive(activeAttempt)) return
        const advance = diaryRecallAdvanceAnnouncement(response)
        if (advance) announceAdvance(advance)
        const [firstStar] = response.episodicMemoryIds
        if (firstStar) requestFlyTarget(firstStar)
        invalidateUniverse()
        invalidateBalance()
        // The balance is refreshed on BOTH paths because a refused paid action can still have moved
        // it; achievements are refreshed only here. A failed action recorded no progress, and
        // refetching after one could surface an unlock notice that reads as though it had earned
        // something.
        invalidateAchievements()
        invalidateSyncStatus()
        send({ type: 'DONE' })
        setJumpDiaryId(null)
        onExit()
      } catch (error) {
        if (!paidSession.isActive(activeAttempt)) return
        invalidateBalance()
        if (classifyPaidActionError(error) === 'ambiguous') {
          invalidateUniverse()
          showError(error)
          send({ type: 'ERROR' })
          return
        }
        const recovery = classifyErrorRecovery(error, consent)
        if (recovery === 'sync-consent') {
          paidSession.finish(activeAttempt)
          setAttempt(paidSession.begin(diaryId))
          send({ type: 'CONSENT_REQUIRED' })
          return
        }
        showError(error)
        if (recovery === 'earn') requestEarnGuide()
        paidSession.finish(activeAttempt)
        setAttempt(paidSession.begin(diaryId))
        send({ type: 'ERROR' })
      } finally {
        paidSession.finish(activeAttempt)
      }
    },
    [
      attempt,
      paidSession,
      transport,
      announceAdvance,
      requestFlyTarget,
      invalidateUniverse,
      invalidateBalance,
      invalidateAchievements,
      invalidateSyncStatus,
      requestEarnGuide,
      showError,
      onExit,
      send,
    ],
  )

  const proceedQuote = useCallback(async () => {
    if (!jumpDiaryId || !attempt || attempt.targetKey !== jumpDiaryId) return
    const activeAttempt = attempt
    const status = await syncStatusQuery.refetch()
    if (!paidSession.isActive(activeAttempt)) return
    if (status.data?.needsSync) {
      send({ type: 'JUMP', needsSync: true })
    } else {
      send({ type: 'JUMP', needsSync: false })
      runRecall(jumpDiaryId, false).catch(() => undefined)
    }
  }, [attempt, jumpDiaryId, paidSession, syncStatusQuery, send, runRecall])

  const acceptSync = useCallback(() => {
    if (!jumpDiaryId) return
    send({ type: 'ACCEPT' })
    runRecall(jumpDiaryId, true).catch(() => undefined)
  }, [jumpDiaryId, send, runRecall])

  const rejectSync = useCallback(() => {
    if (attempt) paidSession.invalidate(attempt)
    setAttempt(null)
    send({ type: 'REJECT' })
    setJumpDiaryId(null)
  }, [attempt, paidSession, send])

  const cancelQuote = useCallback(() => {
    if (phase === 'recalling') return
    if (attempt) paidSession.invalidate(attempt)
    setAttempt(null)
    setJumpDiaryId(null)
  }, [attempt, paidSession, phase])

  const exit = useCallback(() => {
    if (phase === 'recalling') return
    if (attempt) paidSession.invalidate(attempt)
    setAttempt(null)
    onExit()
  }, [attempt, paidSession, phase, onExit])

  const initiateJump = useCallback(
    (diaryId: string) => {
      setJumpDiaryId(diaryId)
      setAttempt(paidSession.begin(diaryId))
    },
    [paidSession],
  )

  // Lifted out of DiaryList's listHeader so BOTH views show it: the restore section, the search controls
  // and the view toggle survive the switch to the calendar ([D12]) rather than being duplicated per branch.
  const archiveHeader = (
    <View style={styles.listHeader}>
      <RestoreSection />
      <SearchDiary value={query} onChange={changeQuery} />
      <View style={styles.sortRow}>
        <SegmentedControl
          ariaLabel={m.calendar_view_label()}
          value={view}
          onValueChange={(next) => onViewChange(next === 'calendar' ? 'calendar' : 'list')}
          items={[
            { value: 'list', label: m.calendar_list_view_action() },
            { value: 'calendar', label: m.calendar_view_action() },
          ]}
        />
      </View>
      {/* The sort orders the LIST, so it is hidden while the calendar shows — a control that steers
          nothing visible is noise. */}
      {view === 'list' && (
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>{m.diary_reader_sort_label()}</Text>
          <SegmentedControl
            ariaLabel={m.diary_reader_sort_label()}
            value={query.sort === DiarySort.OLDEST ? 'oldest' : 'newest'}
            onValueChange={(next) =>
              changeQuery((previous) => ({
                ...previous,
                sort: next === 'oldest' ? DiarySort.OLDEST : DiarySort.NEWEST,
              }))
            }
            items={[
              { value: 'newest', label: m.diary_reader_sort_newest() },
              { value: 'oldest', label: m.diary_reader_sort_oldest() },
            ]}
          />
        </View>
      )}
    </View>
  )

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Text style={styles.title}>{m.diary_reader_title()}</Text>
        <Button color="neutral" size="sm" onPress={exit} disabled={phase === 'recalling'}>
          {m.diary_reader_back()}
        </Button>
      </View>
      {/* [D11] said once, plainly: everything on this page is free and the universe clock is still. */}
      <Text style={styles.freeNote}>{m.diary_reader_free_note()}</Text>

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
          openedDiaryId={openedDiaryId}
          onOpen={setOpenedDiaryId}
          onClose={() => setOpenedDiaryId(null)}
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
          ])}
          renderBodyText={(text) => <HighlightedBody text={text} query={query.query ?? ''} />}
          renderActions={(diary) => (
            <View style={styles.rowActions}>
              <RecallDiaryStarsAction
                liveCount={diary.memories.length}
                onInitiate={() => initiateJump(diary.id)}
              />
              {/* Destructive is not the same as paid, so the delete sits on its own line behind a rule
                rather than shoulder to shoulder with the one control that spends ([D11]). */}
              <View style={styles.destructiveRow}>
                <Button
                  color="danger"
                  size="sm"
                  onPress={() => openFullDelete(diary.id)}
                  disabled={diary.memories.length === 0}
                >
                  {m.deletion_delete_entry_action()}
                </Button>
              </View>
            </View>
          )}
        />
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
  freeNote: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.xs },
  listHeader: { gap: tokens.spacing[4], paddingBottom: tokens.spacing[2] },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  sortLabel: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  block: { flex: 1, gap: tokens.spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  title: { color: tokens.color.text, fontSize: tokens.fontSize['2xl'], fontWeight: '600' },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  rowActions: { gap: tokens.spacing[3] },
  destructiveRow: {
    alignItems: 'flex-start',
    borderTopColor: tokens.color.border,
    borderTopWidth: 1,
    paddingTop: tokens.spacing[3],
  },
})
