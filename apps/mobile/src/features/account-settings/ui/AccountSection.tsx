import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  AuthProviderKind,
  createGetProfileQueryOptions,
  createListAuthProvidersQueryOptions,
} from '@cosimosi/api-client'
import { useAccountSession } from '@cosimosi/auth/react'
import { Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export function AccountSection() {
  const transport = useTransport()
  const { userId, signingOut, signOut } = useAccountSession()
  const [confirming, setConfirming] = useState(false)
  const profile = useQuery(createGetProfileQueryOptions(transport))
  const providers = useQuery(createListAuthProvidersQueryOptions(transport))

  return (
    <View style={styles.root}>
      <View style={styles.identityRow}>
        <Text style={styles.label}>{m.me_identity_label()}</Text>
        <Text style={styles.identity}>{profile.data?.profile?.email || userId || ''}</Text>
      </View>
      <View style={styles.providers}>
        <Text style={styles.label}>{m.me_provider_label()}</Text>
        {(providers.data?.providers ?? []).map((provider) => {
          const label = providerLabel(provider.kind)
          return label ? (
            <View key={`${provider.kind}-${provider.linkedAt}`} style={styles.identityRow}>
              <Text style={styles.identity}>{label}</Text>
              <Text style={styles.label}>
                {m.me_provider_linked_at({ linkedAt: provider.linkedAt })}
              </Text>
            </View>
          ) : null
        })}
      </View>
      {confirming ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirm}>{m.me_sign_out_confirm()}</Text>
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
              {m.me_sign_out()}
            </Button>
          </View>
        </View>
      ) : (
        <View style={styles.signOutRow}>
          <Button color="neutral" size="sm" onPress={() => setConfirming(true)}>
            {m.me_sign_out()}
          </Button>
        </View>
      )}
    </View>
  )
}

function providerLabel(kind: AuthProviderKind): string | null {
  if (kind === AuthProviderKind.GOOGLE) return m.me_provider_google()
  if (kind === AuthProviderKind.PASSWORD) return m.me_provider_password()
  return null
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  providers: { gap: 8 },
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
