import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createSyncStatusQueryKey,
  createSyncStatusQueryOptions,
  type GetDiariesInput,
} from '@cosimosi/api-client'
import { classifyErrorRecovery } from '@cosimosi/errors'
import type { Diary } from '@cosimosi/memory'
import { useEarnRequestStore } from '@cosimosi/twinkle'
import { Button, DeleteIcon, Dialog, IconButton, SegmentedControl, tokens } from '@cosimosi/ui'
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
  useSpotlightStore,
  type DiaryReaderPhase,
  type PaidActionAttempt,
  type PaidActionSession,
} from '@cosimosi/universe'

import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { useAdvanceAnnouncementStore } from '../../../features/accelerate-time/index.ts'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { RestoreSection } from '../../../features/restore-memory/index.ts'
import { DiaryEntry, DiaryList, useDiaryArchive } from '../../../features/read-diary-list/index.ts'
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

  // The ORDER is deliberately absent: it narrows nothing, so an archive read oldest-first is not a
  // filtered archive and 조건 지우기 must not turn it back over.
  const conditionsActive =
    (query.query ?? '') !== '' ||
    (query.moods ?? []).length > 0 ||
    (query.from ?? '') !== '' ||
    (query.to ?? '') !== '' ||
    query.minMemories !== undefined ||
    query.maxMemories !== undefined

  const clearConditions = useCallback(() => {
    changeQuery((previous) => ({
      ...previous,
      query: '',
      moods: [],
      from: '',
      to: '',
      minMemories: undefined,
      maxMemories: undefined,
    }))
  }, [changeQuery])

  // The month is RESOLVED rather than stored, from the archive page the list has already fetched ([D12]).
  const displayedMonth = resolveCalendarMonth(
    month,
    diaries.map((diary) => diary.diaryDate),
    new Date(),
  )
  const calendar = useDiaryCalendar(displayedMonth, view === 'calendar')

  // Selecting a day opens that day's writing over the calendar, so the month stays where it is. It
  // opens the DAY, not a guessed entry: a day may hold several diaries and the modal shows all of
  // them ([D12][D8]). The read is a second archive page bounded to that one date, issued only once a
  // day is picked, and it does not own the shared mirror the list already fills.
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  // Held here rather than inside the panel: the archive body swaps between branches as reads settle,
  // and a disclosure owned down there would refold every time one did.
  const [moodsOpen, setMoodsOpen] = useState(false)
  // Bounded by the DATE ALONE, deliberately: the grid marks every day that holds writing, without
  // regard for the keyword or the mood chips, so a day the reader can see marked must open to what
  // it is marked for. Carrying the conditions in would let a marked day open onto nothing.
  const dayArchive = useDiaryArchive(
    { sort: query.sort, from: dayModalDate ?? '', to: dayModalDate ?? '' },
    { enabled: dayModalDate !== null, mirror: false },
  )
  const selectDay = useCallback((date: string) => setDayModalDate(date), [])

  const [snapshot, send] = useMachine(diaryReaderMachine)
  const phase = snapshot.value as DiaryReaderPhase

  const transport = useTransport()
  const queryClient = useQueryClient()
  const announceAdvance = useAdvanceAnnouncementStore((state) => state.announce)
  const requestFlyTarget = usePendingFlyTargetStore((state) => state.request)
  const spotlight = useSpotlightStore((state) => state.spotlight)
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
    // An entry the reader opened themselves outranks a request still paging for its diary: swapping
    // the body under an open surface would replace what they are reading with something they never
    // asked for. The request is dropped rather than queued — they are already in the archive.
    if (openedDiaryId) {
      clearDeepLink()
      return
    }
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
    openedDiaryId,
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
        // The camera goes to one star; the spotlight is what makes ARRIVING legible. The universe is
        // re-laying itself out behind the glide, so a jump that only moved the camera read as a
        // screen load — the sky holding back while these stars lift is the answer to "which ones".
        spotlight(response.episodicMemoryIds)
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
      spotlight,
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
      {/* Every condition of the archive in one gathered block — keyword, order, feelings, star count
          and the way back out. The ORDER steers the list, so it is withheld while the calendar shows:
          a control that moves nothing visible is noise ([D12]). */}
      <SearchDiary
        value={query}
        onChange={changeQuery}
        moodsOpen={moodsOpen}
        onMoodsOpenChange={setMoodsOpen}
        sortable={view === 'list'}
      />
    </View>
  )

  // One opened entry, wherever it was opened from — the archive's own modal and the calendar's day
  // modal show the same thing, so they compose the same body and the same two controls.
  //
  // `dismiss` closes the surface holding it FIRST: both controls open a dialog of their own, and a
  // second scrim over the first is the one thing this reader never does. The destructive one sits in
  // the entry's top-right corner rather than beside the paid one.
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

  const openedDiary = openedDiaryId
    ? (diaries.find((diary) => diary.id === openedDiaryId) ?? null)
    : null
  // The archive can lose the entry under an open surface — a release elsewhere, a refetch that
  // returns a shorter set. Letting the id outlive its diary would make the surface reappear the
  // moment a later page happened to carry that id again, unprompted.
  useEffect(() => {
    if (openedDiaryId && !openedDiary && !isLoading) setOpenedDiaryId(null)
  }, [openedDiaryId, openedDiary, isLoading])

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
          onClose={() => setDayModalDate(null)}
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
                <View key={diary.id}>{openedEntry(diary, () => setDayModalDate(null))}</View>
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
