import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { createSyncStatusQueryKey, createSyncStatusQueryOptions } from '@cosimosi/api-client'
import { Button, Dialog, tokens } from '@cosimosi/ui'
import {
  classifyPaidActionError,
  createPaidActionSession,
  diaryReaderMachine,
  diaryRecallAdvanceAnnouncement,
  requestRecallDiaryStars,
  useChargeRequestStore,
  useDeletionTargetStore,
  useOpenDiaryTargetStore,
  usePendingFlyTargetStore,
  type DiaryReaderPhase,
  type PaidActionAttempt,
  type PaidActionSession,
} from '@cosimosi/universe'

import { useInvalidateTwinkleBalance } from '../../../entities/twinkle/index.ts'
import { useAdvanceAnnouncementStore } from '../../../features/accelerate-time/index.ts'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { RestoreSection } from '../../../features/restore-memory/index.ts'
import { DiaryList, useDiaryArchive } from '../../../features/read-diary-list/index.ts'
import { RecallDiaryStarsAction } from '../../../features/recall-diary-stars/index.ts'
import { SpendCostDisplay, diaryRecallSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useMachine } from '../../../shared/model/index.ts'
import { useInvalidateUniverse } from '../model/invalidate-universe.ts'

// widgets/diary-reader (RN fork, [D2][D3]): the archive block. It composes the free read
// (read-diary-list) with the one paid action (recall-diary-stars) and owns the jump machine + the
// quote/consent sequencing: quote → consent (server sync-status, never a local Date, A1) →
// RecallDiaryStars (client operation id + explicit consent, A2/A3) → announce the acceleration, fly
// to a recovered star, invalidate the reads, hand back to the universe. Non-dismissible while
// recalling (A4) — header back / Dialog close / cancel inert — and a late completion is fenced to
// the active operation. Hardcodes no price (CC3); navigates only via the `onExit` seam. Shares
// model with the web fork.
export function DiaryReaderBlock({ onExit }: { onExit: () => void }) {
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

  const syncStatusQuery = useQuery(createSyncStatusQueryOptions(transport))

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
        invalidateSyncStatus()
        send({ type: 'DONE' })
        setJumpDiaryId(null)
        onExit()
      } catch (error) {
        if (!paidSession.isActive(activeAttempt)) return
        invalidateBalance()
        if (classifyPaidActionError(error) === 'ambiguous') {
          invalidateUniverse()
          send({ type: 'ERROR' })
          return
        }
        if (!consent) {
          const status = await syncStatusQuery.refetch()
          if (!paidSession.isActive(activeAttempt)) return
          paidSession.finish(activeAttempt)
          setAttempt(paidSession.begin(diaryId))
          if (status.data?.needsSync) {
            send({ type: 'CONSENT_REQUIRED' })
            return
          }
        } else {
          paidSession.finish(activeAttempt)
          setAttempt(paidSession.begin(diaryId))
        }
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
      syncStatusQuery,
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

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Text style={styles.title}>{m.diary_reader_title()}</Text>
        <Button color="neutral" size="sm" onPress={exit} disabled={phase === 'recalling'}>
          {m.diary_reader_back()}
        </Button>
      </View>

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
          <View style={styles.rowActions}>
            <RecallDiaryStarsAction
              liveCount={diary.memories.length}
              onInitiate={() => initiateJump(diary.id)}
            />
            <Button
              color="danger"
              size="sm"
              onPress={() => openFullDelete(diary.id)}
              disabled={diary.memories.length === 0}
            >
              {m.deletion_delete_entry_action()}
            </Button>
          </View>
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
            <Text style={styles.muted}>{m.diary_reader_jumping()}</Text>
          )}
        </Dialog>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { flex: 1, gap: tokens.spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  title: { color: tokens.color.text, fontSize: tokens.fontSize.lg, fontWeight: '500' },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
})
