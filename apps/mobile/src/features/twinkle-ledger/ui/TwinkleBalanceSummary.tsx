import { StyleSheet, Text, View } from 'react-native'

import { useTwinkleBalanceStore } from '@cosimosi/twinkle'
import { useTwinkleBalanceQuery } from '@cosimosi/twinkle/react'
import { tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// The two kinds, each labeled, with NO SUMMED FIGURE. A total belongs on the universe HUD, where the
// paying actions are recalls and a recall really can draw SMALL→GENERAL ([G2][G5]). Here — on the
// surface a purchase is contemplated from — a total would overstate spending power, because an ornament
// prices against GENERAL alone ([P9]). The guard is the ABSENT number, not an annotation explaining it.
export function TwinkleBalanceSummary() {
  const small = useTwinkleBalanceStore((state) => state.small)
  const general = useTwinkleBalanceStore((state) => state.general)
  const loaded = useTwinkleBalanceStore((state) => state.loaded)
  // The tab is its own reader — mounted without the overlay, nothing else would fetch the balance.
  useTwinkleBalanceQuery()

  return (
    <View accessibilityLabel={m.twinkle_balance_title()} style={styles.summary}>
      <View style={styles.line}>
        <Text style={styles.label}>{m.twinkle_balance_small_label()}</Text>
        <Text style={styles.figure}>{loaded ? String(small) : '—'}</Text>
      </View>
      <View style={styles.line}>
        <Text style={styles.label}>{m.twinkle_balance_general_label()}</Text>
        <Text style={styles.figure}>{loaded ? String(general) : '—'}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  summary: { gap: tokens.spacing[2] },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  figure: { color: tokens.color.text, fontSize: tokens.fontSize.base },
})
