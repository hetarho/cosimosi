import { useEarnRequestStore } from '@cosimosi/twinkle'
import { Button, Dialog } from '@cosimosi/ui'
import { useRecallFlowController } from '@cosimosi/universe/react/flows'

import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { CurrentMemoryText } from '../../../entities/episodic-memory/index.ts'
import { RecallRewrite } from '../../../features/recall-star/index.ts'
import { RecallResult } from './RecallResult.tsx'
import { SpendCostDisplay } from '../../../features/spend-cost-display/index.ts'
import { restoreMemoryTextSpend } from '@cosimosi/twinkle'
import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast } from '@cosimosi/errors/react'

// The shared action controller fences both intents: free reconstruction uses blank inputs,
// stored-text restoration uses a quote and no rewrite. The canvas stays mounted under the host.
export function RecallFlowSheet() {
  const requestEarnGuide = useEarnRequestStore((state) => state.request)
  const {
    phase,
    mode,
    memoryId,
    result,
    parts,
    answers,
    setAnswer,
    canConfirm,
    inputLocked,
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
    <Dialog
      open
      onClose={close}
      title={mode === 'restore' ? m.memory_restore_title() : m.recall_flow_title()}
      closeLabel={m.common_dismiss()}
    >
      <div className="flex flex-col gap-4">
        {(phase === 'quoting' || phase === 'rewriting' || phase === 'reconsolidating') &&
          memoryId &&
          (phase !== 'quoting' ? (
            <>
              {mode === 'restore' ? <CurrentMemoryText spans={spans} /> : null}
              {mode === 'restore' ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-text-muted">{m.memory_restore_description()}</p>
                  <Button disabled={phase === 'reconsolidating'} onClick={confirmRecall}>
                    {phase === 'reconsolidating' ? m.common_loading() : m.memory_restore_confirm()}
                  </Button>
                </div>
              ) : (
                <RecallRewrite
                  parts={parts}
                  answers={answers}
                  onAnswer={setAnswer}
                  canConfirm={canConfirm}
                  inputLocked={inputLocked}
                  onConfirm={confirmRecall}
                  busy={phase === 'reconsolidating'}
                />
              )}
            </>
          ) : (
            <SpendCostDisplay
              pending={restoreMemoryTextSpend(memoryId)}
              onProceed={acceptQuote}
              onCancel={close}
              onEarn={requestEarnGuide}
            />
          ))}
        {phase === 'result' && result && (
          <>
            {mode === 'restore' ? <p>{m.memory_restore_result()}</p> : null}
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
