import { useCallback, useEffect, useMemo } from 'react'
import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createMemoryServiceQueryKey, createSyncStatusQueryOptions } from '@cosimosi/api-client'
import { classifyErrorRecovery } from '@cosimosi/errors/core'
import { useMachine } from '@cosimosi/state-machine/react'
import { applyRecallResult, requestRecall, recallAdvanceAnnouncement } from '../recall-star.ts'
import { classifyPaidActionError, createPaidActionSession } from '../paid-action-session.ts'
import { recallFlowMachine, recallOutcome, type RecallFlowPhase } from '../recall-flow.machine.ts'
import { useEpisodicMemoryStore } from '../episodic-memory-store.ts'
import { useRecallTargetStore } from '../recall-target-store.ts'
import { useRecallDraftStore } from '../recall-draft-store.ts'
import { useUniverseClockStore } from '../universe-clock-store.ts'
import { useAdvanceAnnouncementStore } from '../advance-announcement-store.ts'
import { currentDecaySpans } from '../current-decay-text.ts'
import { useCompletionScope } from './use-completion-scope.ts'

export function useRecallFlowController({
  onError: showError,
  invalidateBalance,
  invalidateAchievements,
  requestEarnGuide,
}: {
  onError(error: unknown): void
  invalidateBalance(): void
  invalidateAchievements(): void
  requestEarnGuide(): void
}) {
  const memoryId = useRecallTargetStore((state) => state.memoryId)
  const clearTarget = useRecallTargetStore((state) => state.clear)
  const universeTime = useUniverseClockStore((state) => state.currentUniverseTime)
  const memory = useEpisodicMemoryStore((state) => (memoryId ? state.byId[memoryId] : undefined))

  const [snapshot, send, actor] = useMachine(recallFlowMachine)
  const phase = snapshot.value as RecallFlowPhase

  // The cost gate ([G4], A5): 회고하기 is priced before it happens. The display shows the
  // recall quote first; only on its proceed does the rewrite reveal. A basic-affordable recall
  // proceeds straight through (A9); a shortfall opens the charge sheet (A4).
  // Every action that can record progress refreshes the achievement read on resolution, which is
  // also what feeds the unlock notice's diff — there is no push and no polling anywhere.

  const rewrite = useRecallDraftStore((state) => state.rewrite)
  const result = useRecallDraftStore((state) => state.result)
  const setRewrite = useRecallDraftStore((state) => state.setRewrite)
  const setResult = useRecallDraftStore((state) => state.setResult)
  const resetDraft = useRecallDraftStore((state) => state.reset)

  const announceAdvance = useAdvanceAnnouncementStore((state) => state.announce)
  const transport = useTransport()
  const queryClient = useQueryClient()

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
  const { attempt, consented } = snapshot.context
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
    if (attempt && attempt.targetKey !== memoryId) {
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

      send({ type: 'OPEN', needsSync, attempt: paidSession.begin(memoryId) })
    }
  }, [
    attempt,
    memoryId,
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
    // Repeat-submit suppression (A4): ignore a re-submit while one request is in flight.
    if (
      !memoryId ||
      !attempt ||
      attempt.targetKey !== memoryId ||
      actor.getSnapshot().value !== 'rewriting'
    )
      return
    const isCurrent = capture()
    const activeAttempt = attempt
    if (!paidSession.start(activeAttempt)) return
    const activeMemoryId = memoryId

    send({ type: 'RECALL' })
    try {
      const response = await requestRecall(transport, {
        episodicMemoryId: activeMemoryId,
        rewriteText: rewrite,
        operationId: activeAttempt.operationId,
        syncConsent: consented,
      })
      // Fence: a completion whose operation id is no longer active (the flow was closed/reopened)
      // must not mutate the current flow (A4).
      if (!isCurrent() || !paidSession.isActive(activeAttempt)) return
      // Server-authoritative: apply the returned representation (incl. current_text, A7), play the
      // sync interval, and refetch the memory service + balance so the panel/HUD reflect the result.
      applyRecallResult(activeMemoryId, response)
      const advance = recallAdvanceAnnouncement(response)
      if (advance) announceAdvance(advance)
      setResult({
        outcome: recallOutcome(response.reconsolidated),
        currentText: response.currentText,
      })
      invalidateMemory()
      invalidateBalance()
      // The balance is refreshed on BOTH paths because a refused paid action can still have moved it;
      // achievements are refreshed only on success. A failed action recorded no progress, and refetching
      // after it could surface an unlock notice that reads as though the failure had earned something.
      invalidateAchievements()
      send({ type: 'DONE' })
    } catch (error) {
      if (!isCurrent() || !paidSession.isActive(activeAttempt)) return
      invalidateBalance()
      if (classifyPaidActionError(error) === 'ambiguous') {
        // The recall MAY have committed; keep the operation id and the accepted quote so the diarist's re-confirm replays the committed receipt directly —
        // never re-quoting, so a now-depleted balance cannot block recovery of what was paid for
        // (A2/A5). The rewrite text stays in the draft store.
        showError(error)
        send({ type: 'ERROR' })
        return
      }
      // Known refusal — nothing committed; the next attempt is a fresh spend, so mint a new id.
      // Only an un-consented sync race returns to the consent modal; once consent was given, a
      // balance/target/conflict refusal re-quotes (charge path) instead of looping consent (A5).
      const recovery = classifyErrorRecovery(error, consented)
      if (recovery === 'sync-consent') {
        send({ type: 'CONSENT_REQUIRED', attempt: paidSession.begin(activeMemoryId) })
        return
      }
      showError(error)
      if (recovery === 'earn') requestEarnGuide()

      send({ type: 'REQUOTE', attempt: paidSession.begin(activeMemoryId) })
    } finally {
      paidSession.finish(activeAttempt)
    }
  }, [
    memoryId,
    attempt,
    actor,
    capture,
    rewrite,
    consented,
    transport,
    announceAdvance,
    setResult,
    invalidateMemory,
    invalidateBalance,
    invalidateAchievements,
    paidSession,
    requestEarnGuide,
    showError,
    send,
  ])

  return {
    phase,
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
