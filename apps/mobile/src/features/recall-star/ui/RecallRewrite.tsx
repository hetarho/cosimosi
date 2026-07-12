import { StyleSheet, Text, View } from 'react-native'

import { Button, TextArea, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/recall-star ui ([R1], RN fork): an invitation to remember above a session-only rewrite
// field, then the confirm that fires the single Recall. The faded current-text prompt is composed
// above this by the widget; the original Diary is never shown ([I8]).
export function RecallRewrite({
  value,
  onChange,
  onConfirm,
  busy,
}: {
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <View style={styles.root}>
      <Text style={styles.prompt}>{m.recall_rewrite_prompt()}</Text>
      <TextArea
        label={m.recall_rewrite_label()}
        placeholder={m.recall_rewrite_placeholder()}
        value={value}
        onChangeText={onChange}
      />
      <View style={styles.confirm}>
        <Button color="primary" disabled={busy || value.trim() === ''} onPress={onConfirm}>
          {busy ? m.recall_reconsolidating() : m.recall_confirm()}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing[3] },
  prompt: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, lineHeight: 22 },
  confirm: { alignItems: 'flex-end' },
})
