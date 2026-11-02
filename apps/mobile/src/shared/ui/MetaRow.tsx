import { StyleSheet, Text, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

// A row of a reading table. A `reading` row stacks its value under its label and takes half the
// width, so readings sit two to a line; `fullWidth` gives a long value the whole line. The hint says
// what a reading MEANS, under it, because a phone has no hover to open a tip with.
export function MetaRow({
  label,
  value,
  hint,
  reading = false,
  fullWidth = false,
}: {
  label: string
  value: string
  hint?: string
  reading?: boolean
  fullWidth?: boolean
}) {
  return (
    <View style={[styles.metaItem, reading && styles.readingItem, fullWidth && styles.fullWidth]}>
      <View style={[styles.row, reading && styles.readingRow]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, reading && styles.readingValue]}>{value}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  readingItem: { width: '45%', gap: tokens.spacing[2] },
  fullWidth: { width: '100%' },
  readingRow: { flexDirection: 'column', gap: tokens.spacing[1] },
  readingValue: {
    fontSize: tokens.fontSize.base,
    lineHeight: tokens.spacing[6] + tokens.spacing[1],
  },
  metaItem: { gap: tokens.spacing[1] },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: tokens.spacing[4] },
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  value: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  hint: {
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.xs,
    lineHeight: tokens.fontSize.xs * 1.5,
  },
})
