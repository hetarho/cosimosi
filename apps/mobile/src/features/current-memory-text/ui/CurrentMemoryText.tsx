import { StyleSheet, Text } from 'react-native'

import { ObscuredText, tokens } from '@cosimosi/ui'
import type { DecayTextSpan } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

// features/current-memory-text ([R1][G1][F1], RN fork): the episodic star's forgotten current-memory
// text, shown FREE — a pure read that advances no clock, spends no 별가루, restores nothing. The
// composing widget supplies the resolved current decay-stage text already cut into runs (whole while
// vivid, eroded as it decays [F1][R8a]); a run the forgetting took is drawn as a smear rather than as
// the marker standing in for it. The erosion is still not announced. While no text has loaded the
// panel says so rather than inventing content.
export function CurrentMemoryText({ spans }: { spans: readonly DecayTextSpan[] | null }) {
  if (!spans || spans.length === 0) {
    return <Text style={styles.unavailable}>{m.star_detail_text_unavailable()}</Text>
  }
  return <ObscuredText spans={spans.map((span) => ({ text: span.text, obscured: span.lost }))} />
}

const styles = StyleSheet.create({
  unavailable: {
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.sm,
    fontStyle: 'italic',
  },
})
