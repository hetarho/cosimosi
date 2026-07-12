import type { RecallOutcome } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

// The result surface, reflecting the server's branch ([R6]/[R4]) — the FE never decides it (A8).
// Reconsolidated: the memory now reads as the rewrite (its shape reshaped, [V5]); distortion is
// NOT announced ([R8a]) — the copy simply frames the newly-kept account. Reinforced: a plain
// "recalled, unchanged" statement.
export function RecallResult({
  outcome,
  currentText,
}: {
  outcome: RecallOutcome
  currentText: string
}) {
  if (outcome === 'reconsolidated') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-muted">{m.recall_result_reconsolidated()}</p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">{currentText}</p>
      </div>
    )
  }
  return <p className="text-sm leading-relaxed text-text-muted">{m.recall_result_reinforced()}</p>
}
