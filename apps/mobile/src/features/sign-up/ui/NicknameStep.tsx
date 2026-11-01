import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'

import { signUp } from '@cosimosi/api-client'
import { useSignupProfileController } from '@cosimosi/auth/react/signup'
import { getActiveLocale, m, resolveDeviceTimeZone } from '../../../shared/i18n/index.ts'
import { Button, Card, TextField, tokens } from '@cosimosi/ui'

import { InviteAcknowledgment } from './InviteAcknowledgment.tsx'

export interface NicknameStepProps {
  onCompleted: () => void | Promise<void>
}

export function NicknameStep({ onCompleted }: NicknameStepProps) {
  const transport = useTransport()
  const { value, setValue, pending, status, error, submitProfile } = useSignupProfileController({
    submit: (request) => signUp(transport, request),
    locale: getActiveLocale,
    timeZone: resolveDeviceTimeZone,
    onCompleted,
  })
  const handleSubmit = submitProfile

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
        {status === 'failed' ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {error === 'invalid-nickname'
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
