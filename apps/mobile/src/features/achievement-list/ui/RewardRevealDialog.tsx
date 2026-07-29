import { StyleSheet, Text } from 'react-native'

import type { ClaimOutcome } from '@cosimosi/achievement/react'
import { Dialog, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export interface RewardRevealDialogProps {
  outcome: ClaimOutcome | null
  onClose: () => void
}

// A dialog, deliberately not a toast: a self-dismissing toast is exactly a moment that can be missed,
// and it offers no navigation — a reward that funnels somewhere is a campaign, not a recognition.
export function RewardRevealDialog({ outcome, onClose }: RewardRevealDialogProps) {
  return (
    <Dialog
      open={outcome !== null}
      onClose={onClose}
      title={m.achievement_reveal_title()}
      closeLabel={m.achievement_reveal_dismiss()}
    >
      <Text style={styles.body}>
        {outcome?.grantedOrnamentId
          ? m.achievement_reveal_ornament()
          : m.achievement_reveal_twinkle({
              amount: outcome?.grantedTwinkle ?? 0,
              total: outcome?.twinkleTotal ?? 0,
            })}
      </Text>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  body: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
})
