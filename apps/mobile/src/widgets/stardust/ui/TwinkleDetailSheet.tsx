import { StyleSheet, Text, View } from 'react-native'

import { Dialog, tokens } from '@cosimosi/ui'

import { ChargeTwinkleAction } from '../../../features/charge-twinkle/index.ts'
import { EarnGuideSections } from '../../../features/earn-twinkle/index.ts'
import { TwinkleBalance } from '../../../entities/twinkle/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// widgets/stardust ui (RN fork, [G2][G3]): everything 별가루 is, on one surface — what is held, how to
// come by more of it, and how it gathers on its own. It is what the balance reading opens, and the
// shared `Dialog` presents it as a bottom sheet here (TWINK-32).
//
// The order is the reader's question order. They pressed a figure, so the figures come FIRST. The way
// to get more comes SECOND, because someone who opens a balance is usually short of it. How it
// gathers by itself comes LAST — the longest part, and the one a reader in a hurry can leave unread.
//
// It performs nothing itself: it is a composition of three slices that each own their own act, which
// is the only reason a widget may hold them side by side (§3.1).
export function TwinkleDetailSheet({
  open,
  onOpenAchievements,
  onClose,
}: {
  open: boolean
  onOpenAchievements: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={m.twinkle_balance_title()}
      closeLabel={m.common_dismiss()}
    >
      <View style={styles.body}>
        <View style={styles.part}>
          <Text style={styles.label}>{m.twinkle_detail_held_label()}</Text>
          <TwinkleBalance form="list" />
        </View>

        <View style={[styles.part, styles.ruled]}>
          <ChargeTwinkleAction />
        </View>

        <View style={[styles.part, styles.ruled]}>
          <Text style={styles.heading}>{m.twinkle_earn_title()}</Text>
          <EarnGuideSections onOpenAchievements={onOpenAchievements} />
        </View>
      </View>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.spacing[6] },
  part: { gap: tokens.spacing[3] },
  ruled: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border,
    paddingTop: tokens.spacing[6],
  },
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  heading: { color: tokens.color.text, fontSize: tokens.fontSize.base, fontWeight: '500' },
})
