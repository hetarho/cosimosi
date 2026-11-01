import type { ReactNode } from 'react'
import type { useDeletionFlowController } from './use-deletion-flow.ts'

type Flow = ReturnType<typeof useDeletionFlowController>
type Slots = {
  dialog(props: {
    open: boolean
    onClose: Flow['close']
    title: string
    closeLabel: string
    children: ReactNode
  }): ReactNode
  confirm(props: {
    affectedNames: Flow['affectedNames']
    retentionDays: number
    busy: boolean
    error: boolean
    onConfirm: Flow['confirmDelete']
    onCancel: Flow['close']
  }): ReactNode
  phrasing(props: {
    value: string
    onChange: Flow['setPhrase']
    onSuggest: Flow['runSuggest']
    onCancel: Flow['close']
    busy: boolean
    error: boolean
  }): ReactNode
  approval(props: {
    candidates: Flow['candidates']
    selectedIds: Flow['selectedNeuronIds']
    onToggle: Flow['toggle']
    heavyDetected: boolean
    onSeal: Flow['runSeal']
    onBack: Flow['back']
    busy: boolean
    error: boolean
  }): ReactNode
}

/** Shared composition; the host supplies its actual platform controls and copy. */
export function renderDeletionFlow(
  state: Flow,
  slots: Slots,
  copy: { deletion: string; letGo: string; cancel: string },
): ReactNode {
  const { phase } = state
  if (phase === 'idle' || phase === 'done') return null
  const deleting = phase === 'confirmingDelete' || phase === 'deleting'
  return slots.dialog({
    open: true,
    onClose: state.close,
    title: deleting ? copy.deletion : copy.letGo,
    closeLabel: copy.cancel,
    children: [
      deleting
        ? slots.confirm({
            affectedNames: state.affectedNames,
            retentionDays: state.retentionDays,
            busy: phase === 'deleting',
            error: state.error,
            onConfirm: state.confirmDelete,
            onCancel: state.close,
          })
        : null,
      phase === 'phrasing' || phase === 'suggesting'
        ? slots.phrasing({
            value: state.phrase,
            onChange: state.setPhrase,
            onSuggest: state.runSuggest,
            onCancel: state.close,
            busy: phase === 'suggesting',
            error: state.error && phase === 'phrasing',
          })
        : null,
      phase === 'approving' || phase === 'sealing'
        ? slots.approval({
            candidates: state.candidates,
            selectedIds: state.selectedNeuronIds,
            onToggle: state.toggle,
            heavyDetected: state.heavyDetected,
            onSeal: state.runSeal,
            onBack: state.back,
            busy: phase === 'sealing',
            error: state.error && phase === 'approving',
          })
        : null,
    ],
  })
}
