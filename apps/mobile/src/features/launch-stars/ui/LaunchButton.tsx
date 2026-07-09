import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export interface LaunchButtonProps {
  readonly pastDated: boolean
  readonly busy?: boolean
  readonly onLaunch: () => void
}

// features/launch-stars ui (RN fork): 별 띄우기 ([W3]). A past-dated diary surfaces the one-time
// confirmation notice before launch — saved without a star ([W5][T1][I10]).
export function LaunchButton({ pastDated, busy, onLaunch }: LaunchButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (pastDated && confirming) {
    return (
      <View style={styles.confirm}>
        <Text style={styles.notice}>{m.writing_flow_past_date_notice()}</Text>
        <Button color="primary" disabled={busy} onPress={onLaunch}>
          {m.writing_flow_past_date_confirm()}
        </Button>
      </View>
    )
  }

  return (
    <Button
      color="primary"
      disabled={busy}
      onPress={() => (pastDated ? setConfirming(true) : onLaunch())}
    >
      {m.writing_flow_launch_action()}
    </Button>
  )
}

const styles = StyleSheet.create({
  confirm: { gap: 8 },
  notice: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    backgroundColor: tokens.color.surface,
    padding: 12,
    color: tokens.color['text-muted'],
    fontSize: 13,
    lineHeight: 20,
  },
})
