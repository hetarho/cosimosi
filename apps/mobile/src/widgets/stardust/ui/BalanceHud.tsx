import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { TwinkleBalance } from '../../../entities/twinkle/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// The persistent, restrained balance reading over the canvas (RN fork). No surface, and the two
// readings stacked: icons and figures drawn straight over the sky like the numbers in a game's HUD. A
// card wide enough for two labelled figures cannot share a line with the centred clock on a phone, and
// a phone has room for the numbers a diarist glances at rather than the words naming them. The names
// are one tap away — the stack is a disclosure, and expanding it puts each label beside its own
// figure. The web sibling renders exactly this below `sm` and a labelled pill above it (§3.5).
//
// `action` is a slot for one control the figures belong to (the earn guide). It goes UNDER the figures
// rather than beside them, which keeps the whole block as narrow as the widest figure — narrow enough
// to sit in the corner without reaching the centred clock beside it.
//
// The disclosure itself carries the region's name, rather than a wrapper naming it a second time: with
// no surface there is no card for a label to belong to, and one name on the control the user actually
// reaches is what a screen reader needs.
export function BalanceHud({ action }: { readonly action?: ReactNode }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={m.twinkle_balance_title()}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
      >
        <TwinkleBalance form="stacked" labelled={expanded} />
      </Pressable>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'flex-end' },
})
