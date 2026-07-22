import { StyleSheet, Text, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

import { twinkleTotal, useTwinkleBalanceStore } from '@cosimosi/twinkle'
import { m } from '../../../shared/i18n/index.ts'

// features/twinkle-balance-hud ui (RN fork, [G2][G5]): the persistent, restrained balance
// overlay. basic (today's daily-reset allowance) and additional (the permanent reserve) are
// shown distinctly, the derived total is the headline. basic is always granted ([G5]), so a
// resolved read is never an empty state — a placeholder shows only until the first
// GetBalance settles. Figures only: no meaning-layer or placement control ([I11]).
export function TwinkleBalanceHud() {
  const basic = useTwinkleBalanceStore((state) => state.basic)
  const additional = useTwinkleBalanceStore((state) => state.additional)
  const loaded = useTwinkleBalanceStore((state) => state.loaded)
  const total = twinkleTotal({ basic, additional })

  return (
    <View accessibilityLabel={m.twinkle_balance_title()} style={styles.root}>
      <Text style={styles.total}>{loaded ? String(total) : '—'}</Text>
      <View style={styles.breakdown}>
        <Text style={styles.sub}>
          {`${m.twinkle_balance_basic_label()} ${loaded ? String(basic) : '—'}`}
        </Text>
        <Text style={styles.sub}>
          {`${m.twinkle_balance_additional_label()} ${loaded ? String(additional) : '—'}`}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'flex-end',
    gap: tokens.spacing[1],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
  total: { color: tokens.color.text, fontSize: tokens.fontSize.base, fontWeight: '500' },
  breakdown: { flexDirection: 'row', gap: tokens.spacing[3] },
  sub: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
})
