import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetProfileQueryOptions } from '@cosimosi/api-client'
import {
  hasSignupCompletion,
  pendingInvite,
  recordSignupCompletion,
  takeSignupCompletion,
} from '@cosimosi/auth'
import { useAuthFacade } from '@cosimosi/auth/react'
import { m } from '@cosimosi/i18n'
import { Button, Card, tokens } from '@cosimosi/ui'

import { NicknameStep } from '../../features/sign-up/index.ts'
import { ChooseMoodColors } from '../../features/choose-mood-colors/index.ts'

export function MobileProfileGate({ children }: { children?: ReactNode }) {
  const transport = useTransport()
  const facade = useAuthFacade()
  const profile = useQuery({
    ...createGetProfileQueryOptions(transport),
    retry: false,
  })
  const profilePresent = profile.data?.profile !== undefined
  const [colorGate, setColorGate] = useState<'show' | 'done'>(() =>
    hasSignupCompletion() ? 'show' : 'done',
  )

  useEffect(() => {
    if (profilePresent) pendingInvite.clear()
  }, [profilePresent])
  useEffect(() => {
    if (colorGate === 'show') takeSignupCompletion()
  }, [colorGate])

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
          setColorGate(takeSignupCompletion() ? 'show' : 'done')
          await profile.refetch()
        }}
      />
    )
  }
  if (colorGate === 'show') {
    return (
      <ChooseMoodColors
        onContinue={() => {
          recordSignupCompletion()
          setColorGate('done')
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
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
})
