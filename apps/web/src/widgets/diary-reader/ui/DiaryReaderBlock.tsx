import { useCallback, useEffect, useRef, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { createSyncStatusQueryKey, createSyncStatusQueryOptions } from '@cosimosi/api-client'
import { classifyErrorRecovery } from '@cosimosi/errors'
import { useChargeRequestStore } from '@cosimosi/twinkle'
import { Button, Dialog } from '@cosimosi/ui'
import {
  classifyPaidActionError,
  createPaidActionSession,
  diaryReaderMachine,
  diaryRecallAdvanceAnnouncement,
  requestRecallDiaryStars,
  useDeletionTargetStore,
  useOpenDiaryTargetStore,
  usePendingFlyTargetStore,
  type DiaryReaderPhase,
  type PaidActionAttempt,
  type PaidActionSession,
} from '@cosimosi/universe'

import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { useAdvanceAnnouncementStore } from '../../../features/accelerate-time/index.ts'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { RestoreSection } from '../../../features/restore-memory/index.ts'
import { DiaryList, useDiaryArchive } from '../../../features/read-diary-list/index.ts'
import { RecallDiaryStarsAction } from '../../../features/recall-diary-stars/index.ts'
import { SpendCostDisplay, diaryRecallSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast, useMachine } from '../../../shared/model/index.ts'
import { useInvalidateUniverse } from '@cosimosi/universe/react'

// widgets/diary-reader ([D2][D3]): the archive block. It composes the free read (read-diary-list)
// with the one paid action (recall-diary-stars) and owns the jump machine + the quote/consent
// sequencing: quote → consent (driven by the server sync-status read, never a local Date, A1) →
// RecallDiaryStars (carrying a client operation id + explicit consent, A2/A3) → announce the
// acceleration, fly the camera to a recovered star, invalidate the reads, and hand back to the
// universe. The jump is non-dismissible while recalling (A4) — header back / Dialog close / cancel
// are inert — and a late completion is fenced to the active operation. It hardcodes no price (CC3)
// and navigates only through the `onExit` seam its app-layer host supplies.
export function DiaryReaderBlock({ onExit }: { onExit: () => void }) {
  const showError = useErrorToast()
  const { diaries, isLoading, isError, hasMore, isLoadingMore, loadMore } = useDiaryArchive()
  const [openedDiaryId, setOpenedDiaryId] = useState<string | null>(null)
  const [jumpDiaryId, setJumpDiaryId] = useState<string | null>(null)
  const sessionRef = useRef<PaidActionSession | null>(null)
  if (sessionRef.current === null) sessionRef.current = createPaidActionSession()
  const paidSession = sessionRef.current
  const [attempt, setAttempt] = useState<PaidActionAttempt | null>(null)

  const [snapshot, send] = useMachine(diaryReaderMachine)
  const phase = snapshot.value as DiaryReaderPhase

  const transport = useTransport()
  const queryClient = useQueryClient()
  const announceAdvance = useAdvanceAnnouncementStore((state) => state.announce)
  const requestFlyTarget = usePendingFlyTargetStore((state) => state.request)
  const requestCharge = useChargeRequestStore((state) => state.request)
  const openFullDelete = useDeletionTargetStore((state) => state.openFullDelete)
  const invalidateBalance = useInvalidateTwinkleBalance()
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
    const match = diaries.find((diary) =>
      diary.memories.some((member) => member.episodicMemoryId === deepLinkMemoryId),
    )
    if (match) {
      setOpenedDiaryId(match.id)
      clearDeepLink()
      return
    }
    if (hasMore && !isLoadingMore) loadMore()
    else if (!hasMore) clearDeepLink()
  }, [deepLinkMemoryId, diaries, hasMore, isLoadingMore, loadMore, clearDeepLink])

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
        invalidateUniverse()
        invalidateBalance()
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
        if (recovery === 'charge') requestCharge()
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
      invalidateSyncStatus,
      requestCharge,
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

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-medium text-text">{m.diary_reader_title()}</h1>
        <Button color="neutral" size="sm" onClick={exit} disabled={phase === 'recalling'}>
          {m.diary_reader_back()}
        </Button>
      </header>

      {/* The soft-deleted "지운 일기" restore section sits beside the immutable archive it survives
          within ([W6][D4]) — this session's releases only (an accepted v1 limit). */}
      <RestoreSection />

      <DiaryList
        diaries={diaries}
        openedDiaryId={openedDiaryId}
        onOpen={setOpenedDiaryId}
        onClose={() => setOpenedDiaryId(null)}
        isLoading={isLoading}
        isError={isError}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        renderActions={(diary) => (
          <div className="flex flex-wrap items-center gap-2">
            <RecallDiaryStarsAction
              liveCount={diary.memories.length}
              onInitiate={() => initiateJump(diary.id)}
            />
            <Button
              color="danger"
              size="sm"
              onClick={() => openFullDelete(diary.id)}
              disabled={diary.memories.length === 0}
            >
              {m.deletion_delete_entry_action()}
            </Button>
          </div>
        )}
      />

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
              onCharge={requestCharge}
            />
          ) : (
            <p className="text-sm text-text-muted">{m.diary_reader_jumping()}</p>
          )}
        </Dialog>
      )}
    </div>
  )
}
