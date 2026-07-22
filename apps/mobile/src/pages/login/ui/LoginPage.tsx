import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native'

import { useAuthFacade, useSessionSnapshot } from '@cosimosi/auth/react'
import { m } from '@cosimosi/i18n'
import { Button, Card, TextField, tokens } from '@cosimosi/ui'

/**
 * The mobile login entry ([U3][U4]): the RN mirror of the web LoginPage over the SAME [04] facade
 * action — parity by discipline, not a shared route package (§3.5). It only calls signIn and
 * reflects the snapshot; the session machine, adapter, refresh, and token storage are untouched, and
 * there is no sign-up / verification / password-reset beyond what the adapter exposes. On reaching
 * authenticated the gate swaps to the universe stack, so this screen never navigates itself.
 */
export function LoginPage() {
  const facade = useAuthFacade()
  const { status, error } = useSessionSnapshot()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const pending = status === 'signingIn'

  const handleSubmit = () => {
    // The facade drives the machine toward authenticated (the gate swaps stacks) or surfaces the
    // failure on the snapshot's `error`; a rejected promise is already reflected there.
    facade.signIn({ email, password }).catch(() => undefined)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <Card style={styles.card}>
        <Text style={styles.title}>{m.login_title()}</Text>
        <TextField
          label={m.login_email_label()}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!pending}
        />
        <TextField
          label={m.login_password_label()}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          editable={!pending}
        />
        {error ? <Text style={styles.error}>{m.login_failed()}</Text> : null}
        <Button color="primary" onPress={handleSubmit} loading={pending} disabled={pending}>
          {m.login_submit()}
        </Button>
      </Card>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { gap: 16 },
  title: { color: tokens.color.text, fontSize: 20, fontWeight: '600' },
  error: { color: tokens.color.danger, fontSize: 14 },
})
