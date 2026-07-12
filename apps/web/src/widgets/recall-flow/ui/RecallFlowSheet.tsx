import { useCallback, useEffect } from 'react'

import { useTransport } from '@connectrpc/connect-query'

import { Button, Dialog } from '@cosimosi/ui'
import {
  applyRecallResult,
  recallAdvanceAnnouncement,
  recallFlowMachine,
  recallOutcome,
  requestRecall,
  useRecallTargetStore,
  useUniverseClockStore,
  type RecallFlowPhase,
} from '@cosimosi/universe'

import { useAdvanceAnnouncementStore } from '../../../features/accelerate-time/index.ts'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { CurrentMemoryText } from '../../../features/current-memory-text/index.ts'
import { RecallResult, RecallRewrite } from '../../../features/recall-star/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useMachine } from '../../../shared/model/index.ts'
import { useRecallDraftStore } from '../model/recall-draft-store.ts'

// Today in the user's own timezone (the writing-flow precedent) — toISOString() would emit the UTC
// date, a day behind for KST users in the 00:00–09:00 window.
const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// widgets/recall-flow ([R1]): the summon-and-rewrite flow as a modal over the running canvas (no
// renderer remount, A1). It composes features/recall-star + the confirm-time-sync affordance,
// owns the flow machine + the draft store, and enforces the sequencing consent → Recall (sync +
// recall atomic, server-side) → acceleration/reveal. It never calls SyncToToday or the clock
// directly (A11) and hardcodes no price (CC2). Opened by the star-detail panel's 회고하기 intent
// via the shared recall-target store.
export function RecallFlowSheet() {
  const memoryId = useRecallTargetStore((state) => state.memoryId)
  const clearTarget = useRecallTargetStore((state) => state.clear)
  const universeTime = useUniverseClockStore((state) => state.currentUniverseTime)

  const [snapshot, send] = useMachine(recallFlowMachine)
  const phase = snapshot.value as RecallFlowPhase

  const rewrite = useRecallDraftStore((state) => state.rewrite)
  const result = useRecallDraftStore((state) => state.result)
  const setRewrite = useRecallDraftStore((state) => state.setRewrite)
  const setResult = useRecallDraftStore((state) => state.setResult)
  const resetDraft = useRecallDraftStore((state) => state.reset)

  const announceAdvance = useAdvanceAnnouncementStore((state) => state.announce)
  const transport = useTransport()

  // Recall syncs the clock to today server-side; the consent modal is shown only when the clock is
  // behind ([R1a]). Reading is never enough to move it — the sync fires only on the confirmed call.
  const needsSync = universeTime !== null && universeTime < todayIso()

  useEffect(() => {
    if (memoryId && phase === 'idle') {
      resetDraft()
      send({ type: 'OPEN', needsSync })
    }
  }, [memoryId, phase, needsSync, send, resetDraft])

  const close = useCallback(() => {
    send({ type: 'CLOSE' })
    clearTarget()
    resetDraft()
  }, [send, clearTarget, resetDraft])

  const reject = useCallback(() => {
    send({ type: 'REJECT' })
    clearTarget()
    resetDraft()
  }, [send, clearTarget, resetDraft])

  const confirmRecall = useCallback(async () => {
    if (!memoryId) return
    send({ type: 'RECALL' })
    try {
      const response = await requestRecall(transport, {
        episodicMemoryId: memoryId,
        rewriteText: rewrite,
      })
      // Server-authoritative: apply the returned anchors to the read model (the star reshapes on
      // reconsolidation), play the returned sync interval, and reflect the server's branch.
      applyRecallResult(memoryId, response)
      const advance = recallAdvanceAnnouncement(response)
      if (advance) announceAdvance(advance)
      setResult({
        outcome: recallOutcome(response.reconsolidated),
        currentText: response.currentText,
      })
      send({ type: 'DONE' })
    } catch {
      // A failed recall applied nothing; return to a retriable rewriting with the rewrite intact.
      send({ type: 'ERROR' })
    }
  }, [memoryId, rewrite, transport, announceAdvance, setResult, send])

  if (phase === 'idle') return null

  if (phase === 'confirmingSync') {
    return (
      <ConfirmTimeSyncDialog open onAccept={() => send({ type: 'ACCEPT' })} onReject={reject} />
    )
  }

  return (
    <Dialog open onClose={close} title={m.recall_flow_title()} closeLabel={m.common_dismiss()}>
      <div className="flex flex-col gap-4">
        {(phase === 'rewriting' || phase === 'reconsolidating') && (
          <>
            <CurrentMemoryText text={null} />
            <RecallRewrite
              value={rewrite}
              onChange={setRewrite}
              onConfirm={confirmRecall}
              busy={phase === 'reconsolidating'}
            />
          </>
        )}
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
