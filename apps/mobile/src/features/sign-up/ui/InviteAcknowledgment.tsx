import { StyleSheet, Text } from 'react-native'

import { pendingInvite } from '@cosimosi/auth'
import { m } from '@cosimosi/i18n'
import { tokens } from '@cosimosi/ui'

export function InviteAcknowledgment() {
  if (!pendingInvite.peek()) return null
  return <Text style={styles.text}>{m.invite_acknowledgment()}</Text>
}

const styles = StyleSheet.create({
  text: { color: tokens.color['text-muted'], fontSize: 14 },
})
