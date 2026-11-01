import { StyleSheet, View } from 'react-native'

import { useEarnRequestStore } from '@cosimosi/twinkle'
import { Button, Dialog, tokens } from '@cosimosi/ui'
import { useRecallFlowController } from '@cosimosi/universe/react/flows'

import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { CurrentMemoryText } from '../../../entities/episodic-memory/index.ts'
import { RecallResult, RecallRewrite } from '../../../features/recall-star/index.ts'
import { SpendCostDisplay, recallSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast } from '@cosimosi/errors/react'

// widgets/recall-flow (RN fork, [R1]): the summon-and-rewrite flow as a modal over the running
// canvas (A1). Composes features/recall-star + the confirm-time-sync affordance, owns the flow
// machine + draft store, and sequences consent → Recall (receipt + sync + recall atomic,
// server-side) → acceleration/reveal. Consent is driven by the server sync-status read, never a
// local Date (A1); the paid call carries a client operation id (A2) and the in-flight state is
// non-dismissible + fenced (A4). Shares all model with the web fork.
export function RecallFlowSheet() {
  const requestEarnGuide = useEarnRequestStore((state) => state.request)
  const {
    phase,
    memoryId,
    result,
    rewrite,
    setRewrite,
    close,
    reject,
    acceptSync,
    confirmRecall,
    acceptQuote,
    spans,
  } = useRecallFlowController({
    onError: useErrorToast(),
    invalidateBalance: useInvalidateTwinkleBalance(),
    invalidateAchievements: useInvalidateAchievements(),
    requestEarnGuide,
  })
  if (phase === 'idle') return null

  if (phase === 'confirmingSync') {
    return <ConfirmTimeSyncDialog open onAccept={acceptSync} onReject={reject} />
  }

  return (
    <Dialog open onClose={close} title={m.recall_flow_title()} closeLabel={m.common_dismiss()}>
      <View style={styles.body}>
        {(phase === 'quoting' || phase === 'rewriting' || phase === 'reconsolidating') &&
          memoryId &&
          (phase !== 'quoting' ? (
            <>
              <CurrentMemoryText spans={spans} />
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
              onProceed={acceptQuote}
              onCancel={close}
              onEarn={requestEarnGuide}
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
