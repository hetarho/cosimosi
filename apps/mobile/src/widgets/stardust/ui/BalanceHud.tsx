import { Pressable, StyleSheet, View } from 'react-native'

import { TwinkleBalance } from '../../../entities/twinkle/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// The persistent, restrained balance reading over the canvas (RN fork). No surface, and the two
// readings stacked: icons and figures drawn straight over the sky like the numbers in a game's HUD. A
// card wide enough for two labelled figures cannot share a line with the centred clock on a phone, and
// a phone has room for the numbers a diarist glances at rather than the words naming them. The web
// sibling renders exactly this below `sm` and a labelled pill above it (§3.5).
//
// The reading IS the way in (TWINK-32): pressing the figures opens the 별가루 panel, which names each
// kind beside its figure and says how to come by more. The control carries the region's name, rather
// than a wrapper naming it a second time: with no surface there is no card for a label to belong to.
export function BalanceHud({ onOpenDetail }: { readonly onOpenDetail?: () => void }) {
  if (!onOpenDetail) {
    return (
      <View style={styles.root}>
        <TwinkleBalance form="stacked" />
      </View>
    )
  }
  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={m.twinkle_balance_title()}
        onPress={onOpenDetail}
      >
        <TwinkleBalance form="stacked" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'flex-end' },
})
