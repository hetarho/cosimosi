import { StyleSheet, Text, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { Button, Dialog, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/earn-twinkle ui (RN fork, [G3]): the guide a shortfall opens. It explains how 별가루
// gathers and performs NO mutation — no client, no transport call, no error state — because v2 has no
// purchase path (PRD §8.3) and the other three paths are earned by living in the product, not by
// pressing a button here.
//
// It lists only the REPEATABLE paths. The one-time signup bonus is deliberately absent: naming a grant
// the reader has already received, and cannot receive again, would read as an offer.
//
// Every figure is a generated constant (CC3) — the FE holds no economy number. The one affordance
// leads to where earning is actually claimed.
export function EarnGuideSheet({
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
      title={m.twinkle_earn_title()}
      closeLabel={m.common_dismiss()}
    >
      <View style={styles.body}>
        <Text style={styles.muted}>{m.twinkle_earn_body()}</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>{m.twinkle_earn_daily_title()}</Text>
          <Text style={styles.muted}>{m.twinkle_earn_daily_body()}</Text>
          <Text style={styles.figure}>{String(VALUES.twinkle.smallDailyAmount)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>{m.twinkle_earn_write_title()}</Text>
          <Text style={styles.muted}>{m.twinkle_earn_write_body()}</Text>
          <Text style={styles.figure}>{String(VALUES.twinkle.earnWrite)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>{m.twinkle_earn_achievement_title()}</Text>
          <Text style={styles.muted}>{m.twinkle_earn_achievement_body()}</Text>
          <View style={styles.actions}>
            <Button color="primary" size="sm" onPress={onOpenAchievements}>
              {m.twinkle_earn_achievement_action()}
            </Button>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>{m.twinkle_earn_invite_title()}</Text>
          <Text style={styles.muted}>{m.twinkle_earn_invite_body()}</Text>
          <View style={styles.row}>
            <Text style={styles.muted}>{m.twinkle_earn_invite_bonus_label()}</Text>
            <Text style={styles.figure}>{String(VALUES.twinkle.earnInviteInvitee)}</Text>
          </View>
        </View>
      </View>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.spacing[6] },
  section: { gap: tokens.spacing[2] },
  heading: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  figure: { color: tokens.color.text, fontSize: tokens.fontSize.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
})
