import { StyleSheet, Text, View } from 'react-native'

import { Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/charge-twinkle ui (RN fork, [G3]): the restrained write-earn confirmation.
// Writing a diary earns Twinkle server-side (the write is the writing flow's, [27]); this
// only renders the reward feedback when that launch resolves. No sales language, no
// decorative emoji — a quiet acknowledgement the diarist can dismiss. The amount is
// generated config (passed in, CC3); the HUD reflects the authoritative credit on refetch.
export function WriteEarnFeedback({
  amount,
  onDismiss,
}: {
  amount: number
  onDismiss: () => void
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.root}>
      <Text style={styles.notice}>{m.twinkle_write_earn_notice()}</Text>
      <Text style={styles.figure}>{String(amount)}</Text>
      <Button color="neutral" size="sm" onPress={onDismiss}>
        {m.common_dismiss()}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
  notice: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  figure: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
})
