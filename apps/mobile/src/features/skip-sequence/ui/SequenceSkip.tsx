import { StyleSheet, Text, View } from 'react-native'

import type { SequenceProgress } from '@cosimosi/sequence'
import { Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/skip-sequence ui (RN fork, [O4]): the one interactive element the chrome owns, rendered
// whenever a run is active and on every step — a guarantee the engine expresses as a transition table
// (SKIP is accepted in every non-terminal state) and this slice expresses by having no condition to
// render under. There is deliberately no confirmation: replay makes a mis-skip cheap.
export function SequenceSkip({
  progress,
  onSkip,
}: {
  progress: SequenceProgress
  onSkip: () => void
}) {
  return (
    <View style={styles.bar}>
      <Text style={styles.progress}>
        {m.sequence_progress({ current: progress.current, total: progress.total })}
      </Text>
      <Button color="neutral" size="sm" onPress={onSkip}>
        {m.sequence_skip_action()}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: tokens.spacing[4],
    right: tokens.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  progress: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
})
