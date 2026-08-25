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
      {/* Sign-out is the press itself. Nothing is destroyed by leaving and the way back in is the
          login screen the gate already routes to, so a confirm step would only charge a second tap
          for a reversible action. Withdrawal, which does destroy, keeps its own confirmation. */}
      <View style={styles.signOutRow}>
        <Button
          color="neutral"
          size="sm"
          disabled={signingOut}
          onPress={() => {
            // The rejected case is already surfaced on the auth session snapshot; the flag reset in
            // the api keeps the action usable.
            signOut().catch(() => undefined)
          }}
        >
          {m.me_sign_out()}
        </Button>
      </View>
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
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  identity: {
    color: tokens.color.text,
    flexShrink: 1,
    fontSize: tokens.fontSize.sm,
    textAlign: 'right',
  },
  signOutRow: { alignItems: 'flex-end' },
})
