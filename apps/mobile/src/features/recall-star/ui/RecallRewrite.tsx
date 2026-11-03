import { StyleSheet, Text, View } from 'react-native'
import { Button, TextField, tokens } from '@cosimosi/ui'
import type { RecallPassagePart } from '@cosimosi/universe'
import { m } from '../../../shared/i18n/index.ts'

export function RecallRewrite({
  parts,
  answers,
  onAnswer,
  canConfirm,
  inputLocked,
  onConfirm,
  busy,
}: {
  parts: readonly RecallPassagePart[] | null
  answers: Readonly<Record<number, string>>
  onAnswer: (index: number, value: string) => void
  canConfirm: boolean
  inputLocked: boolean
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <View style={styles.root}>
      <Text style={styles.prompt}>{m.recall_rewrite_prompt()}</Text>
      {parts === null ? (
        <Text style={styles.prompt}>{m.common_loading()}</Text>
      ) : (
        <View style={styles.passage}>
          {parts.map((part) =>
            part.lost ? (
              <TextField
                key={part.index}
                label={m.recall_blank_label({ position: part.blankNumber })}
                placeholder={m.recall_rewrite_placeholder()}
                value={answers[part.index] ?? ''}
                onChangeText={(value) => onAnswer(part.index, value)}
                editable={!busy && !inputLocked}
                autoComplete="off"
              />
            ) : (
              <Text key={part.index} style={styles.text}>
                {part.text}
              </Text>
            ),
          )}
        </View>
      )}
      {parts && !parts.some((part) => part.lost) ? (
        <Text style={styles.prompt}>{m.recall_no_missing_words()}</Text>
      ) : null}
      <View style={styles.confirm}>
        <Button color="primary" disabled={busy || !canConfirm} onPress={onConfirm}>
          {busy ? m.recall_reconsolidating() : m.recall_confirm()}
        </Button>
      </View>
    </View>
  )
}
const styles = StyleSheet.create({
  root: { gap: tokens.spacing[4] },
  passage: { gap: tokens.spacing[2] },
  prompt: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, lineHeight: 22 },
  text: { color: tokens.color.text, fontSize: tokens.fontSize.sm, lineHeight: 24 },
  confirm: { alignItems: 'flex-end' },
})
