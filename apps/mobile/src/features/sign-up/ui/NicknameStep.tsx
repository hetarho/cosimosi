import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'

import { signUp } from '@cosimosi/api-client'
import {
  pendingInvite,
  readErrorMessage,
  recordSignupCompletion,
  validateNickname,
} from '@cosimosi/auth'
import { getActiveLocale, m, resolveDeviceTimeZone } from '@cosimosi/i18n'
import { asyncCommandMachine } from '@cosimosi/state-machine'
import { Button, Card, TextField, tokens } from '@cosimosi/ui'

import { useMachine } from '../../../shared/model/index.ts'
import { InviteAcknowledgment } from './InviteAcknowledgment.tsx'

export interface NicknameStepProps {
  onCompleted: () => void | Promise<void>
}

export function NicknameStep({ onCompleted }: NicknameStepProps) {
  const transport = useTransport()
  const [value, setValue] = useState('')
  const [snapshot, send, actorRef] = useMachine(asyncCommandMachine)
  const pending = snapshot.context.status === 'submitting'

  const handleSubmit = async () => {
    if (actorRef.getSnapshot().context.status === 'submitting') return
    const validation = validateNickname(value)
    send({ type: 'SUBMIT', commandId: 'signup-profile' })
    const attempt = actorRef.getSnapshot().context.attempt
    if (!validation.valid) {
      send({ type: 'REJECT', error: 'invalid-nickname', attempt })
      return
    }

    const inviteToken = pendingInvite.consume() ?? ''
    try {
      const response = await signUp(transport, {
        nickname: validation.nickname,
        timezone: resolveDeviceTimeZone() ?? 'UTC',
        locale: getActiveLocale(),
        inviteToken,
      })
      recordSignupCompletion()
      send({ type: 'RESOLVE', resultId: response.nickname, attempt })
      await onCompleted()
    } catch (error) {
      send({
        type: 'REJECT',
        error: readErrorMessage(error, 'signup failed'),
        attempt,
      })
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <Card style={styles.card}>
        <Text style={styles.title}>{m.signup_nickname_title()}</Text>
        <InviteAcknowledgment />
        <TextField
          label={m.signup_nickname_label()}
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          editable={!pending}
        />
        {snapshot.context.status === 'failed' ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {snapshot.context.error === 'invalid-nickname'
              ? m.signup_nickname_invalid()
              : m.signup_nickname_failed()}
          </Text>
        ) : null}
        <Button color="primary" onPress={handleSubmit} loading={pending} disabled={pending}>
          {m.signup_nickname_submit()}
        </Button>
      </Card>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { gap: 16 },
  title: { color: tokens.color.text, fontSize: tokens.fontSize['2xl'], fontWeight: '600' },
  error: { color: tokens.color.danger, fontSize: tokens.fontSize.sm },
})
