import { useEffect, useState, type FormEvent } from 'react'

import { signupCredentialMachine } from '@cosimosi/auth'
import { Button, Card, TextField } from '@cosimosi/ui'

import { InviteAcknowledgment } from '../../../features/sign-up/index.ts'
import { useAuthFacade, useSessionSnapshot } from '@cosimosi/auth/react'
import { m } from '../../../shared/i18n/index.ts'
import { useMachine } from '../../../shared/model/index.ts'

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
  // Which action the visitor last attempted IN THIS MOUNT, so the failure copy and busy
  // indicator match it. `null` = no in-mount attempt: an ambient failure arriving then
  // (an OAuth return landing before this page mounts, or a bootstrap failure) reads as a
  // Google failure — mobile's convention, mirrored for parity.
  const [method, setMethod] = useState<'password' | 'google' | null>(null)
  const pending =
    status === 'signingIn' || (mode === 'signUp' && signupSnapshot.matches('creating'))

  // A back-navigation from the Google consent page can restore this page from the
  // bfcache still holding `signingIn` — abandon that attempt so the form is usable
  // again (the machine must never stick in signingIn).
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) facade.cancelSignIn()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [facade])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
    // On success the page unloads into the Google redirect; failures land on `error`.
    facade.signInWithGoogle().catch(() => undefined)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-text">
      <Card className="w-full max-w-sm">
        {mode === 'signUp' && signupSnapshot.matches('confirmationSent') ? (
          <div className="flex flex-col gap-4">
            <h1 className="text-lg font-medium">{m.signup_title()}</h1>
            <p className="text-sm text-text-muted">{m.signup_confirmation_sent()}</p>
            <Button variant="text" color="neutral" onClick={() => sendSignup({ type: 'RESET' })}>
              {m.signup_confirmation_back()}
            </Button>
            {onModeChange ? (
              <Button variant="text" color="neutral" onClick={() => onModeChange('signIn')}>
                {m.signup_to_login()}
              </Button>
            ) : null}
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <h1 className="text-lg font-medium">
              {mode === 'signUp' ? m.signup_title() : m.login_title()}
            </h1>
            {mode === 'signUp' ? <InviteAcknowledgment /> : null}
            <Button type="button" variant="outlined" onClick={handleGoogle} disabled={pending}>
              {pending && method === 'google'
                ? m.common_loading()
                : mode === 'signUp'
                  ? m.signup_google()
                  : m.login_google()}
            </Button>
            <TextField
              label={mode === 'signUp' ? m.signup_email_label() : m.login_email_label()}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
              required
            />
            <TextField
              label={mode === 'signUp' ? m.signup_password_label() : m.login_password_label()}
              type="password"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
              required
            />
            {(mode === 'signIn' && error) ||
            (mode === 'signUp' &&
              (signupSnapshot.matches('failed') || (method === 'google' && error))) ? (
              <p role="alert" className="text-sm text-danger">
                {method === 'google'
                  ? mode === 'signUp'
                    ? m.signup_google_failed()
                    : m.login_google_failed()
                  : mode === 'signUp'
                    ? m.signup_failed()
                    : m.login_failed()}
              </p>
            ) : null}
            <Button type="submit" color="primary" disabled={pending}>
              {pending && method === 'password'
                ? m.common_loading()
                : mode === 'signUp'
                  ? m.signup_submit()
                  : m.login_submit()}
            </Button>
            {onModeChange ? (
              <Button
                type="button"
                variant="text"
                color="neutral"
                onClick={() => onModeChange(mode === 'signUp' ? 'signIn' : 'signUp')}
              >
                {mode === 'signUp' ? m.signup_to_login() : m.login_to_signup()}
              </Button>
            ) : null}
          </form>
        )}
      </Card>
    </main>
  )
}
