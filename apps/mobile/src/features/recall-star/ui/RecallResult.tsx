import { StyleSheet, Text, View } from 'react-native'

import { tokens } from '@cosimosi/ui'
import type { RecallOutcome } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

// The result surface (RN fork), reflecting the server's branch ([R6]/[R4]) — the FE never decides
// it (A8). Reconsolidated: the newly-kept account (its shape reshaped); distortion NOT announced
// ([R8a]). Reinforced: a plain "recalled, unchanged" statement.
export function RecallResult({
  outcome,
  currentText,
}: {
  outcome: RecallOutcome
  currentText: string
}) {
  if (outcome === 'reconsolidated') {
    return (
      <View style={styles.root}>
        <Text style={styles.note}>{m.recall_result_reconsolidated()}</Text>
        <Text style={styles.text}>{currentText}</Text>
      </View>
    )
  }
  return <Text style={styles.note}>{m.recall_result_reinforced()}</Text>
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing[2] },
  note: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, lineHeight: 22 },
  text: { color: tokens.color.text, fontSize: tokens.fontSize.sm, lineHeight: 22 },
})
