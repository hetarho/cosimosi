import { StyleSheet, Text, View } from 'react-native'

import { Button, TextArea, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/let-go ui step 1 (RN fork, [X6][X7]): say the words. A restrained free-text input framed
// as symbolic release from the first screen, with the honest note that this blurs a trace — it is
// not treatment. The typed phrase lives in the draft store (the widget owns it); this only presents.
export function PhrasingStep({
  value,
  onChange,
  onSuggest,
  onCancel,
  busy,
  error,
}: {
  value: string
  onChange: (value: string) => void
  onSuggest: () => void
  onCancel: () => void
  busy: boolean
  error: boolean
}) {
  return (
    <View style={styles.root}>
      <Text style={styles.prompt}>{m.deletion_letgo_phrasing_prompt()}</Text>
      <Text style={styles.muted}>{m.deletion_letgo_phrasing_note()}</Text>
      <TextArea
        label={m.deletion_letgo_phrasing_label()}
        placeholder={m.deletion_letgo_phrasing_placeholder()}
        value={value}
        onChangeText={onChange}
      />
      {error && <Text style={styles.error}>{m.deletion_letgo_suggest_error()}</Text>}
      <View style={styles.actions}>
        <Button color="neutral" size="sm" onPress={onCancel}>
          {m.deletion_cancel()}
        </Button>
        <Button
          color="primary"
          size="sm"
          onPress={onSuggest}
          disabled={busy || value.trim() === ''}
        >
          {busy ? m.deletion_letgo_suggesting() : m.deletion_letgo_suggest_action()}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing[3] },
  prompt: { color: tokens.color.text, fontSize: tokens.fontSize.sm, lineHeight: 22 },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  error: { color: tokens.color.danger, fontSize: tokens.fontSize.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing[2] },
})
