import { StyleSheet, Text } from 'react-native'

import { tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/current-memory-text ([R1][G1][F1], RN fork): the episodic star's forgotten current
// memory text, shown FREE — a pure read that advances no clock, spends no 별가루, restores nothing
// (A3). The text is supplied by the composing widget from the memory-representation read (still
// deferred); while no source is wired the panel says so rather than inventing content.
export function CurrentMemoryText({ text }: { text: string | null }) {
  if (!text) {
    return <Text style={styles.unavailable}>{m.star_detail_text_unavailable()}</Text>
  }
  return <Text style={styles.text}>{text}</Text>
}

const styles = StyleSheet.create({
  unavailable: {
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.sm,
    fontStyle: 'italic',
  },
  text: { color: tokens.color.text, fontSize: tokens.fontSize.sm, lineHeight: 22 },
})
