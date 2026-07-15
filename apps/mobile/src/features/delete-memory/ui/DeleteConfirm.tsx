import { StyleSheet, Text, View } from 'react-native'

import { Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/delete-memory ui (RN fork, [X1][X2][W6]): the single plainly-worded confirm — no
// type-to-confirm friction gate (the restore window already makes the act safely reversible). It
// states that ALL stars born from the diary are removed, previews them, notes the shared meaning
// kept, and carries both reassurances (restore window + export) with honest post-window wording
// before the removal, which is the user's explicit act ([I1]).
export function DeleteConfirm({
  affectedNames,
  retentionDays,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  affectedNames: readonly string[]
  retentionDays: number
  busy: boolean
  error: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <View style={styles.root}>
      <Text style={styles.lead}>{m.deletion_delete_lead()}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>{m.deletion_delete_affected_label()}</Text>
        {affectedNames.length > 0 ? (
          <View style={styles.chips}>
            {affectedNames.map((name, index) => (
              <Text key={`${name}-${index}`} style={styles.chip}>
                {name}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>{m.deletion_delete_affected_empty()}</Text>
        )}
      </View>

      <Text style={styles.muted}>{m.deletion_delete_kept_shared()}</Text>

      <View style={styles.reassurance}>
        <Text style={styles.body}>
          {m.deletion_delete_restore_reassurance({ days: retentionDays })}
        </Text>
        <Text style={styles.muted}>{m.deletion_delete_export_reassurance()}</Text>
        <Text style={styles.muted}>{m.deletion_delete_permanent_after_window()}</Text>
      </View>

      {error && <Text style={styles.error}>{m.deletion_delete_error()}</Text>}

      <View style={styles.actions}>
        <Button color="neutral" size="sm" onPress={onCancel}>
          {m.deletion_cancel()}
        </Button>
        <Button color="danger" size="sm" onPress={onConfirm} disabled={busy}>
          {busy ? m.deletion_deleting() : m.deletion_delete_confirm()}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing[4] },
  lead: { color: tokens.color.text, fontSize: tokens.fontSize.sm, lineHeight: 22 },
  section: { gap: tokens.spacing[2] },
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 999,
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: tokens.spacing[1],
    color: tokens.color.text,
    fontSize: tokens.fontSize.xs,
  },
  reassurance: {
    gap: tokens.spacing[1],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    padding: tokens.spacing[3],
  },
  body: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  error: { color: tokens.color.danger, fontSize: tokens.fontSize.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing[2] },
})
