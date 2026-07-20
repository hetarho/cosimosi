import { useState, type FormEvent } from 'react'

import { Button, Card, TextField } from '@cosimosi/ui'

import { useAuthFacade, useSessionSnapshot } from '../../../shared/auth/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// The login entry ([U3][U4]): a thin sign-in screen over the [04] facade — the session machine,
// adapter, refresh, and token storage are untouched; this only calls signIn and reflects the
// snapshot. It exposes just what the adapter exposes (email + password) — no sign-up funnel,
// verification, or password-reset. On reaching authenticated the login route navigates away.
export function LoginPage() {
  const facade = useAuthFacade()
  const { status, error } = useSessionSnapshot()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const pending = status === 'signingIn'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // The facade drives the machine toward authenticated (the route navigates away) or surfaces the
    // failure on the snapshot's `error`; a rejected promise is already reflected there.
    facade.signIn({ email, password }).catch(() => undefined)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-text">
      <Card className="w-full max-w-sm">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <h1 className="text-lg font-medium">{m.login_title()}</h1>
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
          {error ? <p className="text-sm text-danger">{m.login_failed()}</p> : null}
          <Button type="submit" color="primary" disabled={pending}>
            {pending ? m.common_loading() : m.login_submit()}
          </Button>
        </form>
      </Card>
    </main>
  )
}
