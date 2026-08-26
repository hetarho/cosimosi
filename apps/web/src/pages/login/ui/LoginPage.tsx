import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { signupCredentialMachine } from '@cosimosi/auth'
import { BrandMark, Button, Card, TextField } from '@cosimosi/ui'

import { InviteAcknowledgment } from '../../../features/sign-up/index.ts'
import { useAuthFacade, useSessionSnapshot } from '@cosimosi/auth/react'
import { useMachine } from '@cosimosi/state-machine/react'
import { m } from '../../../shared/i18n/index.ts'
import { EmptySky } from '../../../widgets/empty-sky/index.ts'

export interface LoginPageProps {
  mode?: 'signIn' | 'signUp'
  onModeChange?: (mode: 'signIn' | 'signUp') => void
  /** The sandbox, for a visitor who arrived at the door before deciding anything. */
  onTryDemo?: () => void
  /** The page that answers "what is this" — the landing, at its own address. */
  onAbout?: () => void
}

/**
 * Whether the door takes an email and a password at all.
 *
 * Off while Google is the only provider the product actually supports. The fields stay ON SCREEN
 * rather than being deleted: someone who came here to type an email is told why the field will not
 * take it, instead of being left to look for a field that is not there. Turning credentials back on
 * is this one flag — the form, its machine and its failure copy are all still wired, which is also
 * why `signup-credential.test.tsx` still proves the wiring.
 *
 * Annotated `boolean` on purpose: it keeps every use below a real branch to the compiler, so nothing
 * downstream of it narrows to dead code while the flag is off.
 */
const CREDENTIAL_ENTRY_ENABLED: boolean = false

/**
 * The door — and, since the origin root became this screen, the product's first contact: the empty
 * sky, the turning mark, one sentence, and the form under it.
 *
 * It is deliberately the landing's first screen and not a variation on it. A visitor who follows the
 * signup ask down the landing arrives here having just been looking at that sky, and a white card on
 * a flat ground would read as a different product — the continuity is what makes the step feel like
 * walking through a door rather than leaving. That the landing now sits at its own address rather
 * than at `/` does not change the rule: whichever of the two a visitor meets first, the other has to
 * look like the same night.
 *
 * The way in is Google alone for now (`CREDENTIAL_ENTRY_ENABLED`), and the screen says so where a
 * visitor is about to reach for a field rather than after they have tried it.
 *
 * **One screen, and only one.** There is no scroll here and nothing below the fold to find: the whole
 * of the choice — Google, email, password, and the way across to the other mode — fits the viewport,
 * so `min-h-dvh` is the height and the sky is `fixed` behind it. `min-h` rather than a pinned `h` is
 * what keeps that safe: on a viewport too short to hold the form (a small phone in landscape, a
 * keyboard eating half the screen) the column grows and scrolls rather than clipping its own submit
 * button, which is the one failure a locked height would produce.
 */
export function LoginPage({ mode = 'signIn', onModeChange, onTryDemo, onAbout }: LoginPageProps) {
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
    <EntryScreen
      title={mode === 'signUp' ? m.signup_title() : m.login_title()}
      onTryDemo={onTryDemo}
      onAbout={onAbout}
    >
      {mode === 'signUp' && signupSnapshot.matches('confirmationSent') ? (
        <div className="flex flex-col gap-4">
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
          {mode === 'signUp' ? <InviteAcknowledgment /> : null}
          <Button type="button" variant="outlined" onClick={handleGoogle} disabled={pending}>
            {pending && method === 'google'
              ? m.common_loading()
              : mode === 'signUp'
                ? m.signup_google()
                : m.login_google()}
          </Button>
          {/* Said directly under the button it is about, before the fields it explains — a notice
              placed after them would only be read by someone who had already tried to type. */}
          {CREDENTIAL_ENTRY_ENABLED ? null : (
            <p className="text-sm text-text-muted">{m.login_google_only()}</p>
          )}
          <TextField
            label={mode === 'signUp' ? m.signup_email_label() : m.login_email_label()}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending || !CREDENTIAL_ENTRY_ENABLED}
            required
          />
          <TextField
            label={mode === 'signUp' ? m.signup_password_label() : m.login_password_label()}
            type="password"
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending || !CREDENTIAL_ENTRY_ENABLED}
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
          <Button type="submit" color="primary" disabled={pending || !CREDENTIAL_ENTRY_ENABLED}>
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
    </EntryScreen>
  )
}

/**
 * The screen both entry modes are held in: the sky, the mark, the sentence, one panel, and the two
 * ways out of it.
 *
 * The title is the screen's, not the panel's, which is what makes the two read as one column rather
 * than as a card with a heading floating on a picture — the same lockup the hero uses, with the form
 * standing where the hero's paragraph does.
 *
 * The mark is large here and small everywhere else. This is the origin root now, so it is the first
 * thing anyone sees of the product and the only place the brand has room to be a picture rather than
 * a label; the header's 20px lockup on the landing is the same solid doing the opposite job.
 *
 * Under the panel are the two SIDE DOORS. A visitor who has never heard of this arrives here rather
 * than on the landing, so the screen has to offer both the sandbox and the explanation — but the ask
 * is the way in, so both stay the design system's quietest SHAPE: text, small, outside the card.
 *
 * They differ in colour rather than in weight, and the order is the page's own rule (public-copy:
 * demo before signup, both times). The demo is `primary` because a stranger has no reason to trust a
 * form yet and the product's whole claim is that it only reads in motion; the explanation is
 * `secondary`, offered to whoever wants the argument instead. Neither is filled, so neither competes
 * with the Google button above them.
 */
function EntryScreen({
  title,
  children,
  onTryDemo,
  onAbout,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly onTryDemo?: () => void
  readonly onAbout?: () => void
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6 py-16 text-text">
      {/* Pinned rather than laid out, so the sky is the same size whatever the form's mode costs in
          height, and a viewport too short to hold the column scrolls the words over a still sky. */}
      <div aria-hidden className="fixed inset-0">
        <EmptySky />
      </div>
      {/* The hero's soft local floor, under the column only. The sky's brightest frame is what glass
          has to survive (ui-principles §5), and this is what the panel's tint is added to rather than
          a hope about which night the visitor gets. */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-1/2 h-104 w-208 max-w-[150vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg/35 blur-3xl"
      />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6">
        <div className="size-24 sm:size-28">
          <BrandMark />
        </div>
        <h1 className="break-keep text-2xl font-semibold tracking-tight text-balance text-text">
          {title}
        </h1>
        <Card variant="glass" className="w-full">
          {children}
        </Card>
        {onTryDemo === undefined && onAbout === undefined ? null : (
          <div className="flex flex-wrap items-center justify-center gap-1">
            {onTryDemo === undefined ? null : (
              <Button variant="text" color="primary" size="sm" onClick={onTryDemo}>
                {m.login_try_demo()}
              </Button>
            )}
            {onAbout === undefined ? null : (
              <Button variant="text" color="secondary" size="sm" onClick={onAbout}>
                {m.login_about()}
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
