import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { useAccountSession } from '@cosimosi/auth/react'

// The basic account section (RN mirror of the web ui over the same api): the read-only identity
// line and sign-out behind a plain confirm step (never an accidental single tap). Account holds
// nothing else in v1. The confirm is local control-state (idle → confirming), trivial by design
// (§3.2).
export function AccountSection() {
  const { userId, signingOut, signOut } = useAccountSession()
  const [confirming, setConfirming] = useState(false)

  return (
    <View style={styles.root}>
      <View style={styles.identityRow}>
        <Text style={styles.label}>{m.settings_identity_label()}</Text>
        <Text style={styles.identity}>{userId ?? ''}</Text>
      </View>
      {confirming ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirm}>{m.settings_sign_out_confirm()}</Text>
          <View style={styles.actions}>
            <Button color="neutral" size="sm" onPress={() => setConfirming(false)}>
              {m.common_cancel()}
            </Button>
            <Button
              color="neutral"
              size="sm"
              disabled={signingOut}
              onPress={() => {
                // The rejected case is already surfaced on the [04] snapshot; the flag reset in
                // the api keeps the action usable.
                signOut().catch(() => undefined)
              }}
            >
              {m.settings_sign_out()}
            </Button>
          </View>
        </View>
      ) : (
        <View style={styles.signOutRow}>
          <Button color="neutral" size="sm" onPress={() => setConfirming(true)}>
            {m.settings_sign_out()}
          </Button>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  identityRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  label: { color: tokens.color['text-muted'], fontSize: 14 },
  identity: { color: tokens.color.text, flexShrink: 1, fontSize: 14, textAlign: 'right' },
  confirmRow: { gap: 12 },
  confirm: { color: tokens.color.text, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  signOutRow: { alignItems: 'flex-end' },
})
