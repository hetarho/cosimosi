import { useEffect, useState, type FormEvent } from 'react'

import { Button, Card, TextField } from '@cosimosi/ui'

import { useAuthFacade, useSessionSnapshot } from '../../../shared/auth/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// The login entry ([U3][U4]): a thin sign-in screen over the [04] facade — the session machine,
// adapter, refresh, and token storage are untouched; this only calls the facade's sign-in actions
// and reflects the snapshot. It exposes just what the adapter exposes (Google OAuth + email +
// password) — no sign-up funnel, verification, or password-reset. On reaching authenticated the
// login route navigates away.
export function LoginPage() {
  const facade = useAuthFacade()
  const { status, error } = useSessionSnapshot()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Which action the visitor last attempted, so the failure copy matches it.
  const [method, setMethod] = useState<'password' | 'google'>('password')
  const pending = status === 'signingIn'

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMethod('password')
    // The facade drives the machine toward authenticated (the route navigates away) or surfaces the
    // failure on the snapshot's `error`; a rejected promise is already reflected there.
    facade.signIn({ email, password }).catch(() => undefined)
  }

  const handleGoogle = () => {
    setMethod('google')
    // On success the page unloads into the Google redirect; failures land on `error`.
    facade.signInWithGoogle().catch(() => undefined)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-text">
      <Card className="w-full max-w-sm">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <h1 className="text-lg font-medium">{m.login_title()}</h1>
          <Button type="button" variant="outlined" onClick={handleGoogle} disabled={pending}>
            {pending && method === 'google' ? m.common_loading() : m.login_google()}
          </Button>
          <TextField
            label={m.login_email_label()}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
            required
          />
          <TextField
            label={m.login_password_label()}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
            required
          />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {method === 'google' ? m.login_google_failed() : m.login_failed()}
            </p>
          ) : null}
          <Button type="submit" color="primary" disabled={pending}>
            {pending && method === 'password' ? m.common_loading() : m.login_submit()}
          </Button>
        </form>
      </Card>
    </main>
  )
}
