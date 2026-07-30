import type { SequenceProgress } from '@cosimosi/sequence'
import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/skip-sequence ui ([O4]): the one interactive element the chrome owns, rendered whenever a
// run is active and on every step — a guarantee the engine expresses as a transition table (SKIP is
// accepted in every non-terminal state) and this slice expresses by having no condition to render
// under. There is deliberately no confirmation: replay makes a mis-skip cheap, and a "are you sure?"
// on a tutorial is a second thing to dismiss.
//
// The progress readout is quiet on purpose. It answers "how much longer" without turning guidance
// into a task list.
export function SequenceSkip({
  progress,
  onSkip,
}: {
  progress: SequenceProgress
  onSkip: () => void
}) {
  return (
    // `z-guide` sits above `z-modal`, so "always visible" survives the steps that point into the
    // writing dialog — a skip hidden behind a panel is not a skip.
    <div className="fixed right-4 top-4 z-[var(--z-guide)] flex items-center gap-3">
      <span className="text-xs text-text-muted tabular-nums">
        {m.sequence_progress({ current: progress.current, total: progress.total })}
      </span>
      <Button color="neutral" size="sm" onClick={onSkip}>
        {m.sequence_skip_action()}
      </Button>
    </div>
  )
}
