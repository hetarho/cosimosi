import { StyleSheet, Text, View } from 'react-native'

import { todayRefillMarker } from '@cosimosi/twinkle'
import { tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// The daily SMALL refill, stated once at the head of the history. Its own component, taking NO
// EntryReason and NO entry id — the structural half of [G7]: the refill is a derivation, so it cannot
// be produced from a ledger row or mistaken for one, and dashed chrome says so visually. The note
// states plainly that it leaves no record, because a reader who scrolls looking for it deserves to know
// why it is not there.
export function TwinkleRefillMarker() {
  const marker = todayRefillMarker()

  return (
    <View style={styles.marker}>
      <View style={styles.line}>
        <Text style={styles.title}>{m.me_stardust_refill_marker()}</Text>
        <Text style={styles.amount}>{`+${String(marker.amount)}`}</Text>
      </View>
      <Text style={styles.note}>{m.me_stardust_refill_note()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  marker: {
    gap: tokens.spacing[1],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  title: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  amount: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  note: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
})
