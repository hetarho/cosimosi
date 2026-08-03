import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { TwinkleGeneralIcon, TwinkleSmallIcon, tokens } from '@cosimosi/ui'

import { useTwinkleBalanceStore } from '@cosimosi/twinkle'
import { m } from '../../../shared/i18n/index.ts'

// features/twinkle-balance-hud ui (RN fork, [G2][G5]): the persistent, restrained balance reading.
// SMALL (today's recall-only allowance) and GENERAL (the universal permanent reserve) are always
// distinct — the same glyph at two densities. SMALL is always granted ([G5]), so a resolved read is
// never an empty state; a placeholder shows only until the first GetBalance settles. Figures only: no
// meaning-layer or placement control ([I11]).
//
// No surface, and the two readings stacked: icons and figures drawn straight over the sky like the
// numbers in a game's HUD. A card wide enough for two labelled figures cannot share a line with the
// centred clock on a phone, and a phone has room for the numbers a diarist glances at rather than the
// words naming them. The names are one tap away — the stack is a disclosure, and expanding it puts each
// label beside its own figure. The web sibling renders exactly this below `sm` and a labelled pill
// above it (§3.5). Legibility without a surface comes from ink weight plus a shadow on the glyphs,
// because the sky underneath is bright wherever the nebula is.
//
// `action` is a slot for one control the figures belong to (the earn guide). It goes UNDER the figures
// rather than beside them, which keeps the whole block as narrow as the widest figure — narrow enough
// to sit in the corner without reaching the centred clock beside it.
//
// The disclosure itself carries the region's name, rather than a wrapper naming it a second time: with
// no surface there is no card for a label to belong to, and one name on the control the user actually
// reaches is what a screen reader needs.
export function TwinkleBalanceHud({ action }: { readonly action?: ReactNode }) {
  const small = useTwinkleBalanceStore((state) => state.small)
  const general = useTwinkleBalanceStore((state) => state.general)
  const loaded = useTwinkleBalanceStore((state) => state.loaded)
  const [expanded, setExpanded] = useState(false)

  const figure = (value: bigint) => (loaded ? String(value) : '—')

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={m.twinkle_balance_title()}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.stack}
      >
        <View style={styles.entry}>
          {expanded ? <Text style={styles.label}>{m.twinkle_balance_small_label()}</Text> : null}
          <TwinkleSmallIcon color={tokens.color['text-muted']} />
          <Text style={styles.figure}>{figure(small)}</Text>
        </View>
        <View style={styles.entry}>
          {expanded ? <Text style={styles.label}>{m.twinkle_balance_general_label()}</Text> : null}
          <TwinkleGeneralIcon color={tokens.color['text-muted']} />
          <Text style={styles.figure}>{figure(general)}</Text>
        </View>
      </Pressable>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'flex-end' },
  stack: { alignItems: 'flex-end', gap: tokens.spacing[1], paddingVertical: tokens.spacing[1] },
  entry: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  figure: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.sm,
    fontWeight: '500',
    // The sky behind is bright wherever the nebula is, and there is no surface to sit on.
    textShadowColor: tokens.color.bg,
    textShadowRadius: 6,
  },
})
