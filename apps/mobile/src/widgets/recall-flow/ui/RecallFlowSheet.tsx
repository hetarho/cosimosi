import { useCallback, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'

import { Button, Dialog, tokens } from '@cosimosi/ui'
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

const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// widgets/recall-flow (RN fork, [R1]): the summon-and-rewrite flow as a modal over the running
// canvas (A1). Composes features/recall-star + the confirm-time-sync affordance, owns the flow
// machine + draft store, and sequences consent → Recall (sync + recall atomic, server-side) →
// acceleration/reveal. It never calls the clock directly (A11) and hardcodes no price (CC2).
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
      applyRecallResult(memoryId, response)
      const advance = recallAdvanceAnnouncement(response)
      if (advance) announceAdvance(advance)
      setResult({
        outcome: recallOutcome(response.reconsolidated),
        currentText: response.currentText,
      })
      send({ type: 'DONE' })
    } catch {
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
      <View style={styles.body}>
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
