import { useEffect, type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetProfileQueryOptions } from '@cosimosi/api-client'
import { pendingInvite } from '@cosimosi/auth'
import { useAuthFacade } from '@cosimosi/auth/react'
import { m } from '@cosimosi/i18n'
import { Button, Card, tokens } from '@cosimosi/ui'

import { NicknameStep } from '../../features/sign-up/index.ts'

export function MobileProfileGate({ children }: { children?: ReactNode }) {
  const transport = useTransport()
  const facade = useAuthFacade()
  const profile = useQuery({
    ...createGetProfileQueryOptions(transport),
    retry: false,
  })
  const profilePresent = profile.data?.profile !== undefined

  useEffect(() => {
    if (profilePresent) pendingInvite.clear()
  }, [profilePresent])

  if (profile.isPending) return <ProfileGateHold />
  if (profile.isError) {
    return (
      <View style={styles.root}>
        <Card style={styles.card}>
          <Text style={styles.label}>{m.signup_profile_refused()}</Text>
          <Button onPress={() => profile.refetch()}>{m.signup_profile_retry()}</Button>
          <Button variant="text" color="neutral" onPress={() => facade.signOut()}>
            {m.signup_profile_sign_out()}
          </Button>
        </Card>
      </View>
    )
  }
  if (!profile.data.profile) {
    return (
      <NicknameStep
        onCompleted={async () => {
          await profile.refetch()
        }}
      />
    )
  }
  return <>{children}</>
}

function ProfileGateHold() {
  return (
    <View style={styles.root}>
      <ActivityIndicator color={tokens.color.primary} />
      <Text style={styles.label}>{m.common_loading()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  card: { gap: 16, width: '100%' },
  label: { color: tokens.color['text-muted'], fontSize: 14 },
})
