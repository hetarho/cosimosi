import { StyleSheet, Text, View } from 'react-native'

import { AddIcon, Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/charge-twinkle ui (RN fork, [G2]): the way to come by more 별가루 than living in the
// product hands over.
//
// It performs NOTHING yet, and says so. There is no purchase path in the product (PROD-16), so the
// control is DISABLED with the reason written beside it rather than left pressable and failing, or
// left out altogether: a reader looking at a balance they have run down needs to know whether more is
// coming at all, and "아직" is a different answer from silence. When a path exists, its request joins
// this feature and the button loses its `disabled`.
export function ChargeTwinkleAction() {
  return (
    <View style={styles.root}>
      <Button color="primary" leadingIcon={<AddIcon />} disabled>
        {m.twinkle_charge_action()}
      </Button>
      <Text style={styles.reason}>{m.twinkle_charge_unavailable()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'stretch', gap: tokens.spacing[2] },
  reason: {
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.xs,
    textAlign: 'center',
  },
})
