import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSyncStatusQueryKey,
  createSyncStatusQueryOptions,
  type RecallDiaryStarsResponse,
} from '@cosimosi/api-client'
import { classifyErrorRecovery } from '@cosimosi/errors/core'
import { useMachine } from '@cosimosi/state-machine/react'

import { diaryReaderMachine, type DiaryReaderPhase } from '../diary-reader.machine.ts'
import { classifyPaidActionError, createPaidActionSession } from '../paid-action-session.ts'
import { diaryRecallAdvanceAnnouncement } from '../recall-diary-stars.ts'
import { requestRecallDiaryStars } from '../recall-diary-stars.ts'
import { usePendingFlyTargetStore } from '../pending-fly-target-store.ts'
import { useSpotlightStore } from '../spotlight-store.ts'
import { useAdvanceAnnouncementStore } from '../advance-announcement-store.ts'
import { useCompletionScope } from './use-completion-scope.ts'
import { useInvalidateUniverse } from './use-invalidate-universe.ts'

export interface DiaryJumpPorts {
  onExit: () => void
  onError: (error: unknown) => void
  invalidateBalance: () => void
  invalidateAchievements: () => void
  requestEarnGuide: () => void
  // The paid call itself; defaults to the RecallDiaryStars RPC on the ambient transport.
  request?: (input: DiaryRecallInput) => Promise<RecallDiaryStarsResponse>
}

export interface DiaryRecallInput {
  diaryId: string
  operationId: string
  syncConsent: boolean
}

// Archive rendering and navigation stay with each host; paid intent and recovery share one owner.
export function useDiaryJump(ports: DiaryJumpPorts) {
  const { onExit, onError } = ports
  const session = useMemo(() => createPaidActionSession(), [])
  const scope = useCompletionScope()
  const [snapshot, send, actor] = useMachine(diaryReaderMachine)
  const phase = snapshot.value as DiaryReaderPhase
  const attempt = snapshot.context.attempt
  const jumpDiaryId = attempt?.targetKey ?? null
  const transport = useTransport()
  const queryClient = useQueryClient()
  const status = useQuery(createSyncStatusQueryOptions(transport))
  const invalidateUniverse = useInvalidateUniverse()
  const announceAdvance = useAdvanceAnnouncementStore((state) => state.announce)
  const requestFlyTarget = usePendingFlyTargetStore((state) => state.request)
  const spotlight = useSpotlightStore((state) => state.spotlight)
  // The ports change identity with every host render; the recall reads them at call time.
  const latest = useRef({ ports, transport })
  useLayoutEffect(() => {
    latest.current = { ports, transport }
  })
  useEffect(() => {
    if (status.error) onError(status.error)
  }, [status.error, onError])

  const runRecall = useCallback(
    async (diaryId: string, consent: boolean) => {
      const active = actor.getSnapshot().context.attempt
      if (!active || active.targetKey !== diaryId || !session.start(active)) return
      const isCurrent = scope()
      const isActive = () => isCurrent() && session.isActive(active)
      const { ports: current, transport: activeTransport } = latest.current
      const request =
        current.request ??
        ((input: DiaryRecallInput) => requestRecallDiaryStars(activeTransport, input))
      const issue = () =>
        request({ diaryId, operationId: active.operationId, syncConsent: consent })
      try {
        let response
        try {
          response = await issue()
        } catch (error) {
          if (!isActive()) return
          if (classifyPaidActionError(error) !== 'ambiguous') throw error
          response = await issue()
        }
        if (!isActive()) return
        const advance = diaryRecallAdvanceAnnouncement(response)
        if (advance) announceAdvance(advance)
        const first = response.episodicMemoryIds[0]
        if (first) requestFlyTarget(first)
        spotlight(response.episodicMemoryIds)
        invalidateUniverse()
        current.invalidateBalance()
        current.invalidateAchievements()
        void queryClient
          .invalidateQueries({ queryKey: createSyncStatusQueryKey(activeTransport) })
          .catch(() => undefined)
        send({ type: 'DONE' })
        current.onExit()
      } catch (error) {
        if (!isActive()) return
        current.invalidateBalance()
        if (classifyPaidActionError(error) === 'ambiguous') {
          invalidateUniverse()
          current.onError(error)
          send({ type: 'ERROR' })
          return
        }
        const recovery = classifyErrorRecovery(error, consent)
        session.finish(active)
        send({ type: 'ERROR' })
        send({ type: 'START', attempt: session.begin(diaryId) })
        if (recovery === 'sync-consent') {
          send({ type: 'JUMP', needsSync: true })
          return
        }
        current.onError(error)
        if (recovery === 'earn') current.requestEarnGuide()
      } finally {
        session.finish(active)
      }
    },
    [
      actor,
      session,
      scope,
      announceAdvance,
      requestFlyTarget,
      spotlight,
      invalidateUniverse,
      queryClient,
      send,
    ],
  )

  const proceedQuote = useCallback(async () => {
    const active = actor.getSnapshot().context.attempt
    if (!active || !session.isActive(active)) return
    const isCurrent = scope()
    const fresh = await status.refetch()
    if (!isCurrent() || !session.isActive(active)) return
    if (fresh.error) {
      onError(fresh.error)
      return
    }
    if (!fresh.data) return
    send({ type: 'JUMP', needsSync: fresh.data.needsSync })
    if (!fresh.data.needsSync) await runRecall(active.targetKey, false)
  }, [actor, session, scope, status, onError, send, runRecall])
  const acceptSync = useCallback(() => {
    if (actor.getSnapshot().value !== 'confirming') return
    const active = actor.getSnapshot().context.attempt
    if (!active) return
    send({ type: 'ACCEPT' })
    void runRecall(active.targetKey, true)
  }, [actor, send, runRecall])
  const cancelQuote = useCallback(() => {
    if (actor.getSnapshot().value === 'recalling') return
    const active = actor.getSnapshot().context.attempt
    if (active) session.invalidate(active)
    send({ type: actor.getSnapshot().value === 'confirming' ? 'REJECT' : 'CANCEL' })
  }, [actor, session, send])
  const exit = useCallback(() => {
    if (actor.getSnapshot().value === 'recalling') return
    cancelQuote()
    onExit()
  }, [actor, cancelQuote, onExit])
  const initiateJump = useCallback(
    (diaryId: string) => {
      if (actor.getSnapshot().value !== 'browsing') return
      send({ type: 'START', attempt: session.begin(diaryId) })
    },
    [actor, send, session],
  )

  return {
    phase,
    jumpDiaryId,
    proceedQuote,
    acceptSync,
    rejectSync: cancelQuote,
    cancelQuote,
    exit,
    initiateJump,
  }
}
