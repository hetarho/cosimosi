import { useEffect, useState } from 'react'
import { AppState, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native'

import { useAuthFacade, useSessionSnapshot } from '@cosimosi/auth/react'
import { m } from '@cosimosi/i18n'
import { Button, Card, TextField, tokens } from '@cosimosi/ui'

/**
 * The mobile login entry ([U3][U4]): the RN mirror of the web LoginPage over the SAME [04] facade
 * actions — parity by discipline, not a shared route package (§3.5). It only calls the facade's
 * sign-in actions and reflects the snapshot; the session machine, adapter, refresh, and token
 * storage are untouched, and there is no sign-up / verification / password-reset beyond what the
 * adapter exposes. On reaching authenticated the gate swaps to the universe stack, so this screen
 * never navigates itself.
 */
export function LoginPage() {
  const facade = useAuthFacade()
  const { status, error } = useSessionSnapshot()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Which action the visitor last attempted IN THIS MOUNT, so the failure copy and
  // busy indicator match it. `null` = no in-mount attempt: the only failure that can
  // arrive then is an OAuth callback completing after a cold start/remount, so it
  // reads as a Google failure.
  const [method, setMethod] = useState<'password' | 'google' | null>(null)
  const pending = status === 'signingIn'

  // Google consent runs in the system browser; a dismissed browser re-foregrounds the
  // app with no callback, so abandon the attempt on re-activation — the machine must
  // never stick in `signingIn`. A callback that still arrives (it can trail the
  // foreground event) simply drives a fresh sign-in, so this cancel is always safe.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') facade.cancelSignIn()
    })
    return () => subscription.remove()
  }, [facade])

  const handleSubmit = () => {
    setMethod('password')
    // The facade drives the machine toward authenticated (the gate swaps stacks) or surfaces the
    // failure on the snapshot's `error`; a rejected promise is already reflected there.
    facade.signIn({ email, password }).catch(() => undefined)
  }

  const handleGoogle = () => {
    setMethod('google')
    facade.signInWithGoogle().catch(() => undefined)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <Card style={styles.card}>
        <Text style={styles.title}>{m.login_title()}</Text>
        <Button
          variant="outlined"
          onPress={handleGoogle}
          loading={pending && method === 'google'}
          disabled={pending}
        >
          {m.login_google()}
        </Button>
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
        {error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {method === 'password' ? m.login_failed() : m.login_google_failed()}
          </Text>
        ) : null}
        <Button
          color="primary"
          onPress={handleSubmit}
          loading={pending && method === 'password'}
          disabled={pending}
        >
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
