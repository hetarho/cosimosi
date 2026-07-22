import { useCallback, useEffect, useRef, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { createMemoryServiceQueryKey, createSyncStatusQueryOptions } from '@cosimosi/api-client'
import { Button, Dialog } from '@cosimosi/ui'
import {
  applyRecallResult,
  classifyPaidActionError,
  createPaidActionSession,
  currentDecayText,
  recallAdvanceAnnouncement,
  recallFlowMachine,
  recallOutcome,
  requestRecall,
  useChargeRequestStore,
  useEpisodicMemoryStore,
  useRecallTargetStore,
  useUniverseClockStore,
  type PaidActionAttempt,
  type PaidActionSession,
  type RecallFlowPhase,
} from '@cosimosi/universe'

import { useInvalidateTwinkleBalance } from '../../../entities/twinkle/index.ts'
import { useAdvanceAnnouncementStore } from '../../../features/accelerate-time/index.ts'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { CurrentMemoryText } from '../../../features/current-memory-text/index.ts'
import { RecallResult, RecallRewrite } from '../../../features/recall-star/index.ts'
import { SpendCostDisplay, recallSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useMachine } from '../../../shared/model/index.ts'
import { useRecallDraftStore } from '../model/recall-draft-store.ts'

// widgets/recall-flow ([R1]): the summon-and-rewrite flow as a modal over the running canvas (no
// renderer remount, A1). It composes features/recall-star + the confirm-time-sync affordance,
// owns the flow machine + the draft store, and enforces the sequencing consent → Recall (receipt +
// sync + recall atomic, server-side) → acceleration/reveal. The consent decision is driven by the
// server sync-status read, never a local Date (A1); the paid call carries a client operation id so
// a response-loss retry replays the committed result without re-spending (A2), and the in-flight
// state is non-dismissible + fenced so a late completion cannot mutate a closed/reopened flow (A4).
export function RecallFlowSheet() {
  const memoryId = useRecallTargetStore((state) => state.memoryId)
  const clearTarget = useRecallTargetStore((state) => state.clear)
  const universeTime = useUniverseClockStore((state) => state.currentUniverseTime)
  const memory = useEpisodicMemoryStore((state) => (memoryId ? state.byId[memoryId] : undefined))

  const [snapshot, send] = useMachine(recallFlowMachine)
  const phase = snapshot.value as RecallFlowPhase

  // The cost gate ([G4], A5): 회고하기 is priced before it happens. The display shows the
  // recall quote first; only on its proceed does the rewrite reveal. A basic-affordable recall
  // proceeds straight through (A9); a shortfall opens the charge sheet (A4).
  const [costPassed, setCostPassed] = useState(false)
  const requestCharge = useChargeRequestStore((state) => state.request)
  const invalidateBalance = useInvalidateTwinkleBalance()

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

  // One controller fences the mounted widget session as well as its current target. The attempt is
  // retained across an ambiguous retry and replaced only for a new intent or known refusal.
  const sessionRef = useRef<PaidActionSession | null>(null)
  if (sessionRef.current === null) sessionRef.current = createPaidActionSession()
  const paidSession = sessionRef.current
  const [attempt, setAttempt] = useState<PaidActionAttempt | null>(null)
  const [consented, setConsented] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const invalidateMemory = useCallback(() => {
    // GetUniverse (restored brightness/reshape), the target provenance (a reconsolidation appended
    // a row), and the sync-status (the clock moved) all belong to the memory service — invalidate
    // the whole service so each re-reads (A7). No polling (§2.7).
    queryClient
      .invalidateQueries({ queryKey: createMemoryServiceQueryKey() })
      .catch(() => undefined)
  }, [queryClient])

  useEffect(() => () => paidSession.invalidate(), [paidSession])

  useEffect(() => {
    // A route/store retarget (including sign-out clearing the target) ends this session even while
    // the dialog is non-dismissible. The captured request may finish, but it can no longer apply.
    if (attempt && attempt.targetKey !== memoryId) {
      paidSession.invalidate(attempt)
      setAttempt(null)
      setSubmitting(false)
      resetDraft()
      setCostPassed(false)
      setConsented(false)
      send({ type: 'SESSION_INVALIDATED' })
      return
    }
    // Wait for the authoritative status before opening, so the consent decision is made from the
    // server clock at open time rather than a racing default (A1). The server still backstops any
    // subsequent race (ErrSyncConsentRequired → CONSENT_REQUIRED), so a stale open never spends
    // without consent.
    if (memoryId && phase === 'idle' && !syncStatusQuery.isLoading) {
      resetDraft()
      setCostPassed(false)
      setConsented(false)
      setAttempt(paidSession.begin(memoryId))
      send({ type: 'OPEN', needsSync })
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
    setAttempt(null)
    setSubmitting(false)
    send({ type: 'CLOSE' })
    clearTarget()
    resetDraft()
    setCostPassed(false)
    setConsented(false)
  }, [attempt, paidSession, phase, send, clearTarget, resetDraft])

  const reject = useCallback(() => {
    if (attempt) paidSession.invalidate(attempt)
    setAttempt(null)
    setSubmitting(false)
    send({ type: 'REJECT' })
    clearTarget()
    resetDraft()
    setCostPassed(false)
    setConsented(false)
  }, [attempt, paidSession, send, clearTarget, resetDraft])

  const acceptSync = useCallback(() => {
    setConsented(true)
    send({ type: 'ACCEPT' })
  }, [send])

  const confirmRecall = useCallback(async () => {
    // Repeat-submit suppression (A4): ignore a re-submit while one request is in flight.
    if (!memoryId || !attempt || attempt.targetKey !== memoryId || submitting) return
    const activeAttempt = attempt
    if (!paidSession.start(activeAttempt)) return
    const activeMemoryId = memoryId
    setSubmitting(true)
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
      if (!paidSession.isActive(activeAttempt)) return
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
      send({ type: 'DONE' })
    } catch (error) {
      if (!paidSession.isActive(activeAttempt)) return
      invalidateBalance()
      if (classifyPaidActionError(error) === 'ambiguous') {
        // The recall MAY have committed; keep the operation id AND the passed cost gate (do not
        // reset costPassed) so the diarist's re-confirm replays the committed receipt directly —
        // never re-quoting, so a now-depleted balance cannot block recovery of what was paid for
        // (A2/A5). The rewrite text stays in the draft store.
        send({ type: 'ERROR' })
        return
      }
      // Known refusal — nothing committed; the next attempt is a fresh spend, so mint a new id.
      // Only an un-consented sync race returns to the consent modal; once consent was given, a
      // balance/target/conflict refusal re-quotes (charge path) instead of looping consent (A5).
      if (!consented) {
        const status = await syncStatusQuery.refetch()
        if (!paidSession.isActive(activeAttempt)) return
        if (paidSession.finish(activeAttempt)) setSubmitting(false)
        setAttempt(paidSession.begin(activeMemoryId))
        if (status.data?.needsSync) {
          send({ type: 'CONSENT_REQUIRED' })
          return
        }
      } else {
        if (paidSession.finish(activeAttempt)) setSubmitting(false)
        setAttempt(paidSession.begin(activeMemoryId))
      }
      setCostPassed(false)
      send({ type: 'ERROR' })
    } finally {
      if (paidSession.finish(activeAttempt)) setSubmitting(false)
    }
  }, [
    memoryId,
    attempt,
    submitting,
    rewrite,
    consented,
    transport,
    announceAdvance,
    setResult,
    invalidateMemory,
    invalidateBalance,
    paidSession,
    syncStatusQuery,
    send,
  ])

  if (phase === 'idle') return null

  if (phase === 'confirmingSync') {
    return <ConfirmTimeSyncDialog open onAccept={acceptSync} onReject={reject} />
  }

  return (
    <Dialog open onClose={close} title={m.recall_flow_title()} closeLabel={m.common_dismiss()}>
      <div className="flex flex-col gap-4">
        {(phase === 'rewriting' || phase === 'reconsolidating') &&
          memoryId &&
          (costPassed ? (
            <>
              <CurrentMemoryText text={memory ? currentDecayText(memory, universeTime) : null} />
              <RecallRewrite
                value={rewrite}
                onChange={setRewrite}
                onConfirm={confirmRecall}
                busy={phase === 'reconsolidating'}
              />
            </>
          ) : (
            <SpendCostDisplay
              pending={recallSpend(memoryId)}
              onProceed={() => setCostPassed(true)}
              onCancel={close}
              onCharge={requestCharge}
            />
          ))}
        {phase === 'result' && result && (
          <>
            <RecallResult outcome={result.outcome} currentText={result.currentText} />
            <div className="flex justify-end">
              <Button color="neutral" onClick={close}>
                {m.common_dismiss()}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
