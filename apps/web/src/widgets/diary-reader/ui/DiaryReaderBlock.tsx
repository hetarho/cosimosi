import { useCallback, useEffect, useState } from 'react'

import { Code, ConnectError } from '@connectrpc/connect'
import { useTransport } from '@connectrpc/connect-query'

import { Button, Dialog } from '@cosimosi/ui'
import {
  diaryReaderMachine,
  diaryRecallAdvanceAnnouncement,
  requestRecallDiaryStars,
  useChargeRequestStore,
  useOpenDiaryTargetStore,
  usePendingFlyTargetStore,
  useUniverseClockStore,
  type DiaryReaderPhase,
} from '@cosimosi/universe'

import { useInvalidateTwinkleBalance } from '../../../entities/twinkle/index.ts'
import { useAdvanceAnnouncementStore } from '../../../features/accelerate-time/index.ts'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { DiaryList, useDiaryArchive } from '../../../features/read-diary-list/index.ts'
import { RecallDiaryStarsAction } from '../../../features/recall-diary-stars/index.ts'
import { SpendCostDisplay, diaryRecallSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useMachine } from '../../../shared/model/index.ts'
import { useInvalidateUniverse } from '../model/invalidate-universe.ts'

// Today in the user's own timezone (the recall-flow precedent) — toISOString() would emit the UTC
// date, a day behind for KST users in the 00:00–09:00 window.
const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// A pre-spend rejection is one the server raised before committing the recall (the spend gate or
// input validation), so nothing was spent and reopening the cost gate for a retry is safe. Any
// other failure is ambiguous — the recall may have committed — so it must not be one-click retried.
function isPreSpendError(error: unknown): boolean {
  if (!(error instanceof ConnectError)) return false
  return (
    error.code === Code.ResourceExhausted ||
    error.code === Code.InvalidArgument ||
    error.code === Code.FailedPrecondition ||
    error.code === Code.NotFound ||
    error.code === Code.Unauthenticated
  )
}

// widgets/diary-reader ([D2][D3]): the archive block. It composes the free read (read-diary-list)
// with the one paid action (recall-diary-stars) and owns the jump machine + the quote/consent
// sequencing: quote → consent (only when the clock is behind, [R1a]) → RecallDiaryStars →
// announce the acceleration, ask the camera to fly to a recovered star, invalidate GetUniverse,
// and hand back to the universe. 아니오 cancels with the clock unmoved and nothing spent; a
// failed recall returns to browsing, retriable. It hardcodes no price (CC3) and navigates only
// through the `onExit` seam its app-layer host supplies (a widget never reaches the router).
export function DiaryReaderBlock({ onExit }: { onExit: () => void }) {
  const { diaries, isLoading, isError, hasMore, isLoadingMore, loadMore } = useDiaryArchive()
  const [openedDiaryId, setOpenedDiaryId] = useState<string | null>(null)
  const [jumpDiaryId, setJumpDiaryId] = useState<string | null>(null)

  const [snapshot, send] = useMachine(diaryReaderMachine)
  const phase = snapshot.value as DiaryReaderPhase

  const transport = useTransport()
  const universeTime = useUniverseClockStore((state) => state.currentUniverseTime)
  const announceAdvance = useAdvanceAnnouncementStore((state) => state.announce)
  const requestFlyTarget = usePendingFlyTargetStore((state) => state.request)
  const requestCharge = useChargeRequestStore((state) => state.request)
  const invalidateBalance = useInvalidateTwinkleBalance()
  const invalidateUniverse = useInvalidateUniverse()

  // The reader is a separate route from the universe's live read, so the clock mirror carries the
  // value from the last universe visit — or null when the reader was reached by a cold deep-link
  // before any universe read. Behind today OR unknown → consent precedes the server-side sync, so a
  // cold deep-link can never spend + advance the clock without the user's explicit yes ([R1a]).
  const needsSync = universeTime === null || universeTime < todayIso()

  // Deep-link consumer ([D2]): the star-detail panel's 원본 일기 보기 parks a memory id here; once a
  // page carrying its diary has loaded, open that diary and clear the request. Left pending across
  // page loads until the owning diary is found (it may sit on a later page).
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
    // The target diary may sit on a later page — pull pages until it is found or the archive is
    // exhausted, then give up (a stale or foreign id never keeps the request pending forever).
    if (hasMore && !isLoadingMore) loadMore()
    else if (!hasMore) clearDeepLink()
  }, [deepLinkMemoryId, diaries, hasMore, isLoadingMore, loadMore, clearDeepLink])

  const runRecall = useCallback(
    async (diaryId: string, fromConsent: boolean) => {
      send(fromConsent ? { type: 'ACCEPT' } : { type: 'JUMP', needsSync: false })
      try {
        const response = await requestRecallDiaryStars(transport, { diaryId })
        // Server-authoritative: play the returned sync interval, ask the camera to glide to a
        // recovered star (an episodic star's id is its own node id), and refetch the universe so
        // its restored brightness shows — the announcement/fly stores survive the route change.
        const advance = diaryRecallAdvanceAnnouncement(response)
        if (advance) announceAdvance(advance)
        const [firstStar] = response.episodicMemoryIds
        if (firstStar) requestFlyTarget(firstStar)
        invalidateUniverse()
        invalidateBalance()
        send({ type: 'DONE' })
        setJumpDiaryId(null)
        onExit()
      } catch (error) {
        invalidateBalance()
        // A pre-spend rejection (e.g. a stale-quote shortfall — the balance dropped since the
        // quote) committed nothing, so reopen the cost gate with a fresh quote — the charge path
        // stays reachable (A4). An ambiguous failure (network/timeout/internal) MAY have committed
        // the recall, so do not offer a one-click retry that could double-spend: refetch the
        // universe and close the jump; the user re-initiates deliberately if needed.
        if (isPreSpendError(error)) {
          send({ type: 'ERROR' })
        } else {
          invalidateUniverse()
          send({ type: 'ERROR' })
          setJumpDiaryId(null)
        }
      }
    },
    [
      send,
      transport,
      announceAdvance,
      requestFlyTarget,
      invalidateUniverse,
      invalidateBalance,
      onExit,
    ],
  )

  const proceedQuote = useCallback(() => {
    if (!jumpDiaryId) return
    if (needsSync) send({ type: 'JUMP', needsSync: true })
    else runRecall(jumpDiaryId, false).catch(() => undefined)
  }, [jumpDiaryId, needsSync, send, runRecall])

  const acceptSync = useCallback(() => {
    if (jumpDiaryId) runRecall(jumpDiaryId, true).catch(() => undefined)
  }, [jumpDiaryId, runRecall])

  const rejectSync = useCallback(() => {
    send({ type: 'REJECT' })
    setJumpDiaryId(null)
  }, [send])

  const cancelQuote = useCallback(() => setJumpDiaryId(null), [])

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-medium text-text">{m.diary_reader_title()}</h1>
        <Button color="neutral" size="sm" onClick={onExit}>
          {m.diary_reader_back()}
        </Button>
      </header>

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
          <RecallDiaryStarsAction
            liveCount={diary.memories.length}
            onInitiate={() => setJumpDiaryId(diary.id)}
          />
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
