import { useEffect, useState } from 'react'
import { AppState, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native'

import { signupCredentialMachine } from '@cosimosi/auth'
import { useAuthFacade, useSessionSnapshot } from '@cosimosi/auth/react'
import { m } from '../../../shared/i18n/index.ts'
import { Button, Card, TextField, tokens } from '@cosimosi/ui'

import { useMachine } from '@cosimosi/state-machine/react'
import { InviteAcknowledgment } from '../../../features/sign-up/index.ts'
/**
 * The mobile login entry ([U3][U4]): the RN mirror of the web LoginPage over the SAME auth-facade
 * actions — parity by discipline, not a shared route package (§3.5). Sign-in and sign-up share
 * the provider actions while email-confirmation presentation stays in the local credential
 * machine; the session status set remains untouched. On reaching authenticated the profile gate
 * decides between nickname completion and the universe stack.
 */
export interface LoginPageProps {
  mode?: 'signIn' | 'signUp'
  onModeChange?: (mode: 'signIn' | 'signUp') => void
}

export function LoginPage({ mode = 'signIn', onModeChange }: LoginPageProps) {
  const facade = useAuthFacade()
  const { status, error } = useSessionSnapshot()
  const [signupSnapshot, sendSignup, signupActorRef] = useMachine(signupCredentialMachine)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Which action the visitor last attempted IN THIS MOUNT, so the failure copy and
  // busy indicator match it. `null` = no in-mount attempt: the only failure that can
  // arrive then is an OAuth callback completing after a cold start/remount, so it
  // reads as a Google failure.
  const [method, setMethod] = useState<'password' | 'google' | null>(null)
  const pending =
    status === 'signingIn' || (mode === 'signUp' && signupSnapshot.matches('creating'))

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

  const handleSubmit = async () => {
    setMethod('password')
    if (mode === 'signIn') {
      await facade.signIn({ email, password }).catch(() => undefined)
      return
    }
    if (signupActorRef.getSnapshot().matches('creating')) return
    sendSignup({ type: 'SUBMIT' })
    try {
      const result = await facade.signUpWithPassword({ email, password })
      sendSignup({
        type: result === 'signedIn' ? 'SIGNED_IN' : 'CONFIRMATION_REQUIRED',
      })
    } catch {
      sendSignup({ type: 'FAILURE', error: 'signup-failed' })
    }
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
        {mode === 'signUp' && signupSnapshot.matches('confirmationSent') ? (
          <>
            <Text style={styles.title}>{m.signup_title()}</Text>
            <Text style={styles.label}>{m.signup_confirmation_sent()}</Text>
            <Button variant="text" color="neutral" onPress={() => sendSignup({ type: 'RESET' })}>
              {m.signup_confirmation_back()}
            </Button>
            {onModeChange ? (
              <Button variant="text" color="neutral" onPress={() => onModeChange('signIn')}>
                {m.signup_to_login()}
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.title}>
              {mode === 'signUp' ? m.signup_title() : m.login_title()}
            </Text>
            {mode === 'signUp' ? <InviteAcknowledgment /> : null}
            <Button
              variant="outlined"
              onPress={handleGoogle}
              loading={pending && method === 'google'}
              disabled={pending}
            >
              {mode === 'signUp' ? m.signup_google() : m.login_google()}
            </Button>
            <TextField
              label={mode === 'signUp' ? m.signup_email_label() : m.login_email_label()}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!pending}
            />
            <TextField
              label={mode === 'signUp' ? m.signup_password_label() : m.login_password_label()}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signUp' ? 'new-password' : 'password'}
              editable={!pending}
            />
            {(mode === 'signIn' && error) ||
            (mode === 'signUp' &&
              (signupSnapshot.matches('failed') || (method === 'google' && error))) ? (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
                {method === 'google'
                  ? mode === 'signUp'
                    ? m.signup_google_failed()
                    : m.login_google_failed()
                  : mode === 'signUp'
                    ? m.signup_failed()
                    : m.login_failed()}
              </Text>
            ) : null}
            <Button
              color="primary"
              onPress={handleSubmit}
              loading={pending && method === 'password'}
              disabled={pending}
            >
              {mode === 'signUp' ? m.signup_submit() : m.login_submit()}
            </Button>
            {onModeChange ? (
              <Button
                variant="text"
                color="neutral"
                onPress={() => onModeChange(mode === 'signUp' ? 'signIn' : 'signUp')}
              >
                {mode === 'signUp' ? m.signup_to_login() : m.login_to_signup()}
              </Button>
            ) : null}
          </>
        )}
      </Card>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { gap: 16 },
  title: { color: tokens.color.text, fontSize: tokens.fontSize['2xl'], fontWeight: '600' },
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  error: { color: tokens.color.danger, fontSize: tokens.fontSize.sm },
})
