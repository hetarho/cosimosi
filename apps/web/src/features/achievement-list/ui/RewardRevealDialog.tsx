import type { ClaimOutcome } from '@cosimosi/achievement/react'
import { Dialog } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export interface RewardRevealDialogProps {
  outcome: ClaimOutcome | null
  onClose: () => void
}

// A dialog, deliberately not a toast. A self-dismissing toast is exactly a moment that can be missed,
// and the recognition IS the reward's other half — so this waits to be closed.
//
// It offers one dismissal and NO navigation: sending someone to 우주 꾸미기 from a reward would turn
// claiming into a funnel.
export function RewardRevealDialog({ outcome, onClose }: RewardRevealDialogProps) {
  return (
    <Dialog
      open={outcome !== null}
      onClose={onClose}
      title={m.achievement_reveal_title()}
      closeLabel={m.achievement_reveal_dismiss()}
    >
      <p className="text-sm text-text-muted">
        {outcome?.grantedOrnamentId
          ? m.achievement_reveal_ornament()
          : m.achievement_reveal_twinkle({
              amount: outcome?.grantedTwinkle ?? 0,
              total: outcome?.twinkleTotal ?? 0,
            })}
      </p>
    </Dialog>
  )
}
