import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Alert, Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export interface LaunchButtonProps {
  readonly pastDated: boolean
  readonly busy?: boolean
  readonly onLaunch: () => void
}

// features/launch-stars ui (RN fork): 별 띄우기 ([W3]). A past-dated diary surfaces the one-time
// confirmation notice before launch — saved without a star ([W5][T1][I10]).
//
// Visual language (web parity): the notice is the design system's inline alert in its warning role,
// `live=status` because the consequence is being offered rather than reported (§9). It takes the
// full row so the sentence is never squeezed beside a button, with the confirming action last (§4).
export function LaunchButton({ pastDated, busy, onLaunch }: LaunchButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (pastDated && confirming) {
    return (
      <View style={styles.confirm}>
        <Alert variant="warning" live="status">
          {m.writing_flow_past_date_notice()}
        </Alert>
        <Button color="primary" style={styles.action} disabled={busy} onPress={onLaunch}>
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
  confirm: { width: '100%', gap: tokens.spacing[3] },
  action: { alignSelf: 'flex-end' },
})
