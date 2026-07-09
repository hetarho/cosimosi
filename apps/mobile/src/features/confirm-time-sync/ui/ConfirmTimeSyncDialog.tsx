import { StyleSheet, Text, View } from 'react-native'

import { Button, Dialog, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export interface ConfirmTimeSyncDialogProps {
  open: boolean
  onAccept: () => void
  onReject: () => void
}

// The reusable sync-consent modal ([T2] case 2 / [R1a]) — the RN fork of the web dialog (§3.5).
// States the consequence, asks, and returns a decision — nothing else. Dismissing (backdrop / ✕ /
// back) is the same 아니오 as the button: the clock must never move on an ambiguous exit.
export function ConfirmTimeSyncDialog({ open, onAccept, onReject }: ConfirmTimeSyncDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onReject}
      title={m.universe_time_sync_consent_title()}
      closeLabel={m.common_dismiss()}
    >
      <View style={styles.content}>
        <Text style={styles.body}>{m.universe_time_sync_consent_body()}</Text>
        <View style={styles.actions}>
          <Button color="neutral" onPress={onReject}>
            {m.universe_time_sync_reject()}
          </Button>
          <Button color="primary" onPress={onAccept}>
            {m.universe_time_sync_accept()}
          </Button>
        </View>
      </View>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  body: { color: tokens.color.text, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
})
