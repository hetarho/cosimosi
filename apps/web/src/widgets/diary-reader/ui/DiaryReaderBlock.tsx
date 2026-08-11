import { useCallback, useEffect, useRef, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createSyncStatusQueryKey,
  createSyncStatusQueryOptions,
  DiarySort,
  type GetDiariesInput,
} from '@cosimosi/api-client'
import { classifyErrorRecovery } from '@cosimosi/errors'
import type { Diary } from '@cosimosi/memory'
import { useEarnRequestStore } from '@cosimosi/twinkle'
import { Button, DeleteIcon, Dialog, IconButton, SegmentedControl, Tooltip } from '@cosimosi/ui'
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

// widgets/diary-reader ([D2][D3]): the archive block. It composes the free read (read-diary-list)
// with the one paid action (recall-diary-stars) and owns the jump machine + the quote/consent
// sequencing: quote → consent (driven by the server sync-status read, never a local Date, A1) →
// RecallDiaryStars (carrying a client operation id + explicit consent, A2/A3) → announce the
// acceleration, fly the camera to a recovered star, invalidate the reads, and hand back to the
// universe. The jump is non-dismissible while recalling (A4) — header back / Dialog close / cancel
// are inert — and a late completion is fenced to the active operation. It hardcodes no price (CC3)
// and navigates only through the `onExit` seam its app-layer host supplies.
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

  // The month is RESOLVED rather than stored, from the archive page the list has already fetched, and is
  // never written back — mounting the calendar must add no history entry, while stepping does ([D12]).
  const displayedMonth = resolveCalendarMonth(
    month,
    diaries.map((diary) => diary.diaryDate),
    new Date(),
  )
  const calendar = useDiaryCalendar(displayedMonth, view === 'calendar')

  // Selecting a day opens that day's writing over the calendar, so the month the reader is browsing
  // stays where it is. It opens the DAY, not a guessed entry: a day may hold several diaries and the
  // modal shows all of them ([D12][D8]). The read is a second archive page bounded to that one date,
  // and it is issued only once a day is picked.
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

  // The consent decision is server-authoritative ([R1a], A1): needsSync comes from the sync-status
  // read (refetched at proceed time below), never a local Date — so a cold deep-link, a UTC-boundary
  // client, or clock skew can never spend + advance the clock without an explicit yes.
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

  // Deep-link consumer ([D2]): the star-detail panel's 원본 일기 보기 parks a memory id here; once a
  // page carrying its diary has loaded, open that diary and clear the request.
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
          // Ambiguous — the jump MAY have committed. Re-issue ONCE with the SAME operation id: if
          // it committed, the server replays the receipt (recovers the jump with no second spend
          // and without re-quoting a now-depleted balance, A2/A5); if it did not, this does the
          // work. A second ambiguous failure falls through to the outer catch.
          response = await issue()
        }
        // Fence (A4): only the active jump's own result animates/flies/exits — a completion whose
        // operation id is no longer active (the jump was closed/re-initiated) is ignored.
        if (!paidSession.isActive(activeAttempt)) return
        const advance = diaryRecallAdvanceAnnouncement(response)
        if (advance) announceAdvance(advance)
        const [firstStar] = response.episodicMemoryIds
        if (firstStar) requestFlyTarget(firstStar)
        // The camera goes to one star; the spotlight is what makes ARRIVING legible. The universe is
        // re-laying itself out behind the glide, so a jump that only moved the camera read as a page
        // load — the sky holding back while these stars lift is the answer to "which ones were they".
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
          // Still ambiguous after the recovery pass: refresh the universe (in case it committed)
          // and return to the quote, keeping the operation id so a deliberate re-submit still
          // cannot double-spend (A2).
          invalidateUniverse()
          showError(error)
          send({ type: 'ERROR' })
          return
        }
        // Known refusal — nothing committed; the next attempt is a fresh spend, so mint a new id.
        // Only an un-consented sync race re-shows the consent modal; once consent was given, a
        // balance/target/conflict refusal re-quotes instead of looping consent (A5).
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
    // Read the authoritative status fresh at the decision point (A1). needsSync → consent modal;
    // otherwise recall straight through (the server still refuses an unconsented sync it does need).
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

  // Cancel / exit are inert while the recall is in flight (A4).
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

  // One opened entry, wherever it was opened from — the archive's own modal and the calendar's day
  // modal show the same thing, so they compose the same body and the same two controls.
  //
  // `dismiss` closes the surface holding it FIRST: both controls open a dialog of their own, and a
  // second scrim and focus trap over the first is the one thing this reader never does. The
  // destructive one sits in the entry's top-right corner rather than beside the paid one, because a
  // labelled danger control next to the door that spends reads as a second thing to do here.
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
                  initiateJump(diary.id)
                }}
              />
            }
          />
        </div>
      </div>
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
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        {/* Which shape of the archive is showing rides beside the title, because it names what this
            page IS right now — the two are one line, and the sort below steers only the list. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-medium text-text">{m.diary_reader_title()}</h1>
            <SegmentedControl
              ariaLabel={m.calendar_view_label()}
              value={view}
              onValueChange={(next) => onViewChange(next === 'calendar' ? 'calendar' : 'list')}
              items={[
                { value: 'list', label: m.calendar_list_view_action() },
                { value: 'calendar', label: m.calendar_view_action() },
              ]}
            />
          </div>
          <Button color="neutral" size="sm" onClick={exit} disabled={phase === 'recalling'}>
            {m.diary_reader_back()}
          </Button>
        </div>
        {/* [D11] said once, plainly: everything on this page is free and the universe clock is still. */}
        <p className="text-xs text-text-subtle">{m.diary_reader_free_note()}</p>
      </header>

      {/* The soft-deleted "지운 일기" restore section sits beside the immutable archive it survives
          within ([W6][D4]) — this session's releases only (an accepted v1 limit). */}
      <RestoreSection />

      <SearchDiary
        value={query}
        onChange={changeQuery}
        moodsOpen={moodsOpen}
        onMoodsOpenChange={setMoodsOpen}
      />

      {/* The sort orders the LIST, so it is hidden while the calendar shows — a control that steers
          nothing visible is noise. */}
      <div className="flex flex-wrap items-center gap-2">
        {view === 'list' && (
          <>
            <span className="text-sm text-text-muted">{m.diary_reader_sort_label()}</span>
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
          </>
        )}
      </div>

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
          paid jump and the delete ([D12] keeps the calendar itself free of either). */}
      {dayModalDate && (
        <Dialog
          open
          onClose={() => setDayModalDate(null)}
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
                <div key={diary.id}>{openedEntry(diary, () => setDayModalDate(null))}</div>
              ))}
            </div>
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
            <p className="text-sm text-text-muted">{m.diary_reader_jumping()}</p>
          )}
        </Dialog>
      )}
    </div>
  )
}
