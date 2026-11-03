import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createMemoryServiceQueryKey, createSyncStatusQueryOptions } from '@cosimosi/api-client'
import type { RecallResponse } from '@cosimosi/api-client'
import { classifyErrorRecovery } from '@cosimosi/errors/core'
import { useMachine } from '@cosimosi/state-machine/react'
import {
  applyRecallResult,
  requestRecall,
  requestRestoreMemoryText,
  recallAdvanceAnnouncement,
  type RecallInput,
} from '../recall-star.ts'
import { classifyPaidActionError, createPaidActionSession } from '../paid-action-session.ts'
import { recallFlowMachine, recallOutcome, type RecallFlowPhase } from '../recall-flow.machine.ts'
import { useEpisodicMemoryStore } from '../episodic-memory-store.ts'
import { useRecallTargetStore } from '../recall-target-store.ts'
import { useRecallDraftStore } from '../recall-draft-store.ts'
import { useUniverseClockStore } from '../universe-clock-store.ts'
import { useAdvanceAnnouncementStore } from '../advance-announcement-store.ts'
import { currentDecaySpans } from '../current-decay-text.ts'
import { useCompletionScope } from './use-completion-scope.ts'

export interface RecallFlowPorts {
  onError(error: unknown): void
  invalidateBalance(): void
  invalidateAchievements(): void
  requestEarnGuide(): void
  // Tests may inject the mutation; production selects the RPC from the explicit intent.
  request?(input: RecallInput): Promise<RecallResponse>
}

export function useRecallFlowController(ports: RecallFlowPorts) {
  const { onError: showError } = ports
  const memoryId = useRecallTargetStore((state) => state.memoryId)
  const mode = useRecallTargetStore((state) => state.mode)
  const intentKey = memoryId ? `${mode}:${memoryId}` : null
  const clearTarget = useRecallTargetStore((state) => state.clear)
  const universeTime = useUniverseClockStore((state) => state.currentUniverseTime)
  const memory = useEpisodicMemoryStore((state) => (memoryId ? state.byId[memoryId] : undefined))

  const [snapshot, send, actor] = useMachine(recallFlowMachine)
  const phase = snapshot.value as RecallFlowPhase

  // Reconstruction is free; stored-text restoration alone passes through the quote phase.
  const rewrite = useRecallDraftStore((state) => state.rewrite)
  const result = useRecallDraftStore((state) => state.result)
  const setRewrite = useRecallDraftStore((state) => state.setRewrite)
  const resetDraft = useRecallDraftStore((state) => state.reset)

  const transport = useTransport()
  const queryClient = useQueryClient()
  // The ports change identity with every host render; the confirm reads them at call time instead of
  // re-binding on each one.
  const latest = useRef({ ports, transport })
  useLayoutEffect(() => {
    latest.current = { ports, transport }
  })

  // Server-authoritative consent gate ([R1a], A1): needsSync comes from the sync-status read, so a
  // client just past/before UTC midnight — or with a skewed clock — never bypasses or spuriously
  // requires consent. The mutation re-checks it server-side and refuses an unconsented sync.
  const syncStatusQuery = useQuery(createSyncStatusQueryOptions(transport))
  const needsSync = syncStatusQuery.data?.needsSync ?? false

  useEffect(() => {
    if (syncStatusQuery.error) showError(syncStatusQuery.error)
  }, [syncStatusQuery.error, showError])

  // One controller fences the mounted widget session as well as its current target. The attempt is
  // retained across an ambiguous retry and replaced only for a new intent or known refusal.
  const paidSession = useMemo(() => createPaidActionSession(), [])
  const { attempt } = snapshot.context
  const capture = useCompletionScope()
  const invalidateMemory = useCallback(() => {
    // GetUniverse (restored brightness/reshape), the target provenance (a reconsolidation appended
    // a row), and the sync-status (the clock moved) all belong to the memory service — invalidate
    // the whole service so each re-reads (A7). No polling (§2.7).
    queryClient
      .invalidateQueries({ queryKey: createMemoryServiceQueryKey() })
      .catch(() => undefined)
  }, [queryClient])

  useEffect(() => {
    // A route/store retarget (including sign-out clearing the target) ends this session even while
    // the dialog is non-dismissible. The captured request may finish, but it can no longer apply.
    if (attempt && attempt.targetKey !== intentKey) {
      paidSession.invalidate(attempt)

      resetDraft()

      send({ type: 'SESSION_INVALIDATED' })
      return
    }
    // Wait for the authoritative status before opening, so the consent decision is made from the
    // server clock at open time rather than a racing default (A1). The server still backstops any
    // subsequent race (ErrSyncConsentRequired → CONSENT_REQUIRED), so a stale open never spends
    // without consent.
    if (memoryId && phase === 'idle' && !syncStatusQuery.isLoading) {
      resetDraft()

      send({
        type: 'OPEN',
        needsSync,
        restore: mode === 'restore',
        attempt: paidSession.begin(`${mode}:${memoryId}`),
      })
    }
  }, [
    attempt,
    memoryId,
    mode,
    intentKey,
    phase,
    needsSync,
    paidSession,
    send,
    resetDraft,
    syncStatusQuery.isLoading,
  ])

  // Close/reject are inert while a paid recall is in flight (A4) — the close button, backdrop, and
  // Escape cannot dismiss `reconsolidating`; the machine also drops CLOSE there.
  const close = useCallback(() => {
    if (phase === 'reconsolidating') return
    if (attempt) paidSession.invalidate(attempt)

    send({ type: 'CLOSE' })
    clearTarget()
    resetDraft()
  }, [attempt, paidSession, phase, send, clearTarget, resetDraft])

  const reject = useCallback(() => {
    if (attempt) paidSession.invalidate(attempt)

    send({ type: 'REJECT' })
    clearTarget()
    resetDraft()
  }, [attempt, paidSession, send, clearTarget, resetDraft])

  const acceptSync = useCallback(() => {
    send({ type: 'ACCEPT' })
  }, [send])

  const confirmRecall = useCallback(async () => {
    // Repeat-submit suppression (A4): ignore a re-submit while one request is in flight. Everything the
    // attempt depends on is read from the machine and the stores at call time.
    const { attempt: activeAttempt, consented: consent } = actor.getSnapshot().context
    const activeMemoryId = useRecallTargetStore.getState().memoryId
    if (
      !activeMemoryId ||
      !activeAttempt ||
      activeAttempt.targetKey !== `${useRecallTargetStore.getState().mode}:${activeMemoryId}` ||
      actor.getSnapshot().value !== 'rewriting'
    )
      return
    const isCurrent = capture()
    if (!paidSession.start(activeAttempt)) return
    const { ports: current, transport: activeTransport } = latest.current
    const restoring = useRecallTargetStore.getState().mode === 'restore'
    const issue =
      current.request ??
      ((input: RecallInput) =>
        restoring
          ? requestRestoreMemoryText(activeTransport, input)
          : requestRecall(activeTransport, input))

    send({ type: 'RECALL' })
    try {
      const response = await issue({
        episodicMemoryId: activeMemoryId,
        rewriteText: useRecallDraftStore.getState().rewrite,
        operationId: activeAttempt.operationId,
        syncConsent: consent,
      })
      // Fence: a completion whose operation id is no longer active (the flow was closed/reopened)
      // must not mutate the current flow (A4).
      if (!isCurrent() || !paidSession.isActive(activeAttempt)) return
      // Server-authoritative: apply the returned representation (incl. current_text, A7), play the
      // sync interval, and refetch the memory service + balance so the panel/HUD reflect the result.
      applyRecallResult(activeMemoryId, response, restoring)
      const advance = recallAdvanceAnnouncement(response)
      if (advance) useAdvanceAnnouncementStore.getState().announce(advance)
      useRecallDraftStore.getState().setResult({
        outcome: recallOutcome(response.reconsolidated),
        currentText: response.currentText,
      })
      invalidateMemory()
      if (restoring) current.invalidateBalance()
      // The balance is refreshed on BOTH paths because a refused paid action can still have moved it;
      // achievements are refreshed only on success. A failed action recorded no progress, and refetching
      // after it could surface an unlock notice that reads as though the failure had earned something.
      current.invalidateAchievements()
      send({ type: 'DONE' })
    } catch (error) {
      if (!isCurrent() || !paidSession.isActive(activeAttempt)) return
      if (restoring) current.invalidateBalance()
      if (classifyPaidActionError(error) === 'ambiguous') {
        // The recall MAY have committed; keep the operation id and the accepted quote so the diarist's
        // re-confirm replays the committed receipt directly — never re-quoting, so a now-depleted
        // balance cannot block recovery of what was paid for. The rewrite text stays in the draft store.
        current.onError(error)
        send({ type: 'ERROR' })
        return
      }
      // A known refusal starts a fresh intent; free reconstruction needs no quote.
      // Only an un-consented sync race returns to the consent modal; once consent was given, a
      // balance/target/conflict refusal re-quotes (charge path) instead of looping consent.
      const recovery = classifyErrorRecovery(error, consent)
      if (recovery === 'sync-consent') {
        send({
          type: 'CONSENT_REQUIRED',
          attempt: paidSession.begin(`${restoring ? 'restore' : 'recall'}:${activeMemoryId}`),
        })
        return
      }
      current.onError(error)
      if (restoring && recovery === 'earn') current.requestEarnGuide()

      send({
        type: 'REQUOTE',
        attempt: paidSession.begin(`${restoring ? 'restore' : 'recall'}:${activeMemoryId}`),
      })
    } finally {
      paidSession.finish(activeAttempt)
    }
  }, [actor, capture, paidSession, send, invalidateMemory])

  return {
    phase,
    mode,
    memoryId,
    result,
    rewrite,
    setRewrite,
    close,
    reject,
    acceptSync,
    confirmRecall,
    acceptQuote: () => send({ type: 'PROCEED' }),
    spans: memory ? currentDecaySpans(memory, universeTime) : null,
  }
}
