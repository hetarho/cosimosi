import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { createMemoryServiceQueryKey, createSyncStatusQueryOptions } from '@cosimosi/api-client'
import { useChargeRequestStore } from '@cosimosi/twinkle'
import { Button, Dialog, tokens } from '@cosimosi/ui'
import {
  applyRecallResult,
  classifyPaidActionError,
  createPaidActionSession,
  currentDecayText,
  recallAdvanceAnnouncement,
  recallFlowMachine,
  recallOutcome,
  requestRecall,
  useEpisodicMemoryStore,
  useRecallTargetStore,
  useUniverseClockStore,
  type PaidActionAttempt,
  type PaidActionSession,
  type RecallFlowPhase,
} from '@cosimosi/universe'

import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { useAdvanceAnnouncementStore } from '../../../features/accelerate-time/index.ts'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { CurrentMemoryText } from '../../../features/current-memory-text/index.ts'
import { RecallResult, RecallRewrite } from '../../../features/recall-star/index.ts'
import { SpendCostDisplay, recallSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useMachine } from '../../../shared/model/index.ts'
import { useRecallDraftStore } from '@cosimosi/universe'

// widgets/recall-flow (RN fork, [R1]): the summon-and-rewrite flow as a modal over the running
// canvas (A1). Composes features/recall-star + the confirm-time-sync affordance, owns the flow
// machine + draft store, and sequences consent → Recall (receipt + sync + recall atomic,
// server-side) → acceleration/reveal. Consent is driven by the server sync-status read, never a
// local Date (A1); the paid call carries a client operation id (A2) and the in-flight state is
// non-dismissible + fenced (A4). Shares all model with the web fork.
export function RecallFlowSheet() {
  const memoryId = useRecallTargetStore((state) => state.memoryId)
  const clearTarget = useRecallTargetStore((state) => state.clear)
  const universeTime = useUniverseClockStore((state) => state.currentUniverseTime)
  const memory = useEpisodicMemoryStore((state) => (memoryId ? state.byId[memoryId] : undefined))

  const [snapshot, send] = useMachine(recallFlowMachine)
  const phase = snapshot.value as RecallFlowPhase

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

  const syncStatusQuery = useQuery(createSyncStatusQueryOptions(transport))
  const needsSync = syncStatusQuery.data?.needsSync ?? false

  const sessionRef = useRef<PaidActionSession | null>(null)
  if (sessionRef.current === null) sessionRef.current = createPaidActionSession()
  const paidSession = sessionRef.current
  const [attempt, setAttempt] = useState<PaidActionAttempt | null>(null)
  const [consented, setConsented] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const invalidateMemory = useCallback(() => {
    // GetUniverse + the target provenance + sync-status all belong to the memory service — one
    // invalidation re-reads each so the panel/HUD reflect the result (A7).
    queryClient
      .invalidateQueries({ queryKey: createMemoryServiceQueryKey() })
      .catch(() => undefined)
  }, [queryClient])

  useEffect(() => () => paidSession.invalidate(), [paidSession])

  useEffect(() => {
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
    // Wait for the authoritative status before opening so the consent decision is server-driven at
    // open time (A1); the server backstops any later race (ErrSyncConsentRequired → CONSENT_REQUIRED).
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
      if (!paidSession.isActive(activeAttempt)) return
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
        // The recall MAY have committed; keep the operation id AND the passed cost gate so the
        // re-confirm replays the committed receipt directly — never re-quoting, so a now-depleted
        // balance cannot block recovery of what was paid for (A2/A5).
        send({ type: 'ERROR' })
        return
      }
      // Known refusal — nothing committed; the next attempt is a fresh spend under a new id. Only
      // an un-consented sync race returns to the consent modal; once consent was given, a
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
      <View style={styles.body}>
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
            <View style={styles.done}>
              <Button color="neutral" onPress={close}>
                {m.common_dismiss()}
              </Button>
            </View>
          </>
        )}
      </View>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.spacing[4] },
  done: { alignItems: 'flex-end' },
})
