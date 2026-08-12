import { useCallback, useEffect } from 'react'

import { Outlet, useLocation, useParams, useSearch } from '@tanstack/react-router'

import { gateDecision, pendingInvite, requiresSignIn } from '@cosimosi/auth'
import { useSessionSnapshot } from '@cosimosi/auth/react'
import {
  LocaleBootstrap,
  m,
  setActiveLocale,
  useActiveLocale,
  type Locale,
} from '../../shared/i18n/index.ts'

import { DecorationBootstrap } from '../providers/decoration-bootstrap.tsx'
import { ProfileGate } from '../providers/profile-gate.tsx'
import { BlogNotFoundPage } from '../../pages/blog-not-found/index.ts'
import { LandingPage } from '../../pages/landing/index.ts'
import { LoginPage } from '../../pages/login/index.ts'
import { writeStoredLocale } from '../../shared/lib/locale-storage.ts'
import { loginReturnTarget } from './guards/auth-gate.ts'
import { useAppNavigate } from './navigation.ts'
import { AchievementNoticeHost } from '../../features/achievement-notice/index.ts'

// The route components live apart from the route-tree config so this file exports
// components only (react-refresh's only-export-components contract); route-tree.tsx
// owns the createRoute wiring and the non-component exports.
//
// This file is the STATIC half of the route surface: the authenticated layout plus every screen a
// stranger can land on cold (the front door, sign-in, sign-up, invite, the blog miss). It rides in
// the entry chunk on purpose — lazy-loading the very page the visitor asked for would add a round
// trip to the path the split exists to speed up. The signed-in product, the admin console and the
// demo sandbox live in `screens/` and are reached through dynamic imports instead.

// The neutral hold shown while the session is bootstrapping/refreshing — no signed-out flash and no
// landing flash either, which is the whole reason `'hold'` survived the front door: a returning user
// mid-refresh must not be shown marketing for a frame.
export function AuthHold() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg text-text-muted">
      <p className="text-sm">{m.common_loading()}</p>
    </main>
  )
}

// The authenticated subtree's layout: the `beforeLoad` guard has already redirected a settled
// signed-out arrival to /login, so this decides only what a passing session renders. If the user
// signs out WHILE mounted, the live snapshot flips to a login decision and this navigates to /login
// (the guard only runs on entry). GetUniverse (and any product read below) mounts only through
// <Outlet/>, so it never issues without a session ([U1][A8]). Future product routes (e.g. /me)
// mount under this same guard.
//
// Only the initial `bootstrapping` hides the universe behind the neutral hold (no read yet). A
// `refreshing` session is provisionally authenticated (its userId is preserved), so the universe
// stays mounted through a token refresh — "hold in place", never a blank or a re-read.
//
// The navigation to /login carries the current location as `from` so a re-sign-in returns here.
// This also covers the common first-load deep link: a direct URL that arrives while the session is
// still bootstrapping passes the (entry-only) guard, then settles to signed-out HERE — carrying
// `from` keeps the return-to-original path the guard's own redirect provides (A7).
export function AuthenticatedLayout() {
  const { status } = useSessionSnapshot()
  const navigate = useAppNavigate()
  const location = useLocation()
  const decision = gateDecision(status)
  useEffect(() => {
    if (requiresSignIn(decision)) {
      navigate({ to: '/login', search: { from: location.pathname } })
    }
  }, [decision, navigate, location.pathname])
  if (status === 'authenticated' || status === 'refreshing') {
    return (
      <ProfileGate>
        <LocaleBootstrap />
        {/* Mounted here and nowhere else. That one placement is three guards at once: a signed-out
            visitor never fetches ListAchievements, /demo cannot mount the watcher, and sign-out
            unmounts the snapshot the diff compares against. */}
        <AchievementNoticeHost />
        <DecorationBootstrap>
          <Outlet />
        </DecorationBootstrap>
      </ProfileGate>
    )
  }
  return <AuthHold />
}

// `/about` is what the product is, for someone who has not decided yet. It carries NO gate: it used to
// be the root, where the session decided which of three surfaces `/` meant, and at its own address there
// is nothing left to decide — a signed-in visitor following a shared link reads the page rather than
// being bounced to their universe, the same way /demo and the blog behave.
//
// The page takes its destinations and the locale seam as callbacks, because `pages` may not import
// `app` (§3.1) — `setActiveLocale` plus persistence lives up here with the rest of the i18n wiring, and
// the page just says which of the two locales the visitor chose.
export function LandingRoute() {
  const navigate = useAppNavigate()
  const locale = useActiveLocale()
  const onSelectLocale = useCallback((next: Locale) => {
    setActiveLocale(next)
    writeStoredLocale(next)
  }, [])
  return (
    <LandingPage
      locale={locale}
      onSelectLocale={onSelectLocale}
      onTryDemo={() => navigate({ to: '/demo' })}
      onSignUp={() => navigate({ to: '/signup' })}
      onSignIn={() => navigate({ to: '/login' })}
    />
  )
}

// A miss under `/blog/**`. The blog itself is static HTML the asset handler serves, so this only ever runs
// when nothing matched — a stale link or a typo. `window.location` rather than a router navigation, because
// `/blog/` is outside this router: a client navigation would land straight back here.
export function BlogNotFoundRoute() {
  return (
    <BlogNotFoundPage
      onBackToBlog={() => {
        window.location.href = '/blog/'
      }}
    />
  )
}

// The entry screen, wherever it stands: on a successful sign-in the session reaches authenticated, so
// this returns the user to the route they were headed for (the guard's `from`, validated) or the
// universe. An already-signed-in visitor is bounced straight there.
//
// The form renders ONLY on a signed-out decision — asked through `requiresSignIn`, never `!== 'hold'`.
// The redirect above is an effect, so a settling session (bootstrapping/refreshing) and an
// authenticated arrival both reach this line before the navigation runs, and either one rendering the
// form would flash a password field at somebody who is already inside. `signingIn` is signed-out and
// keeps the form: that is where the pending sign-in lives.
//
// `from` is the only difference between the two routes that render it, which is why they share a
// component rather than a copy: `/` is the front door a stranger arrives at, `/login` is where the auth
// guard sends a deep link, carrying where it was headed.
//
// It supplies the screen's three destinations — the other mode, the sandbox, and the page that says
// what this is — because a page may not import the router (§3.1).
function EntryDoor({ from }: { readonly from?: string }) {
  const { status } = useSessionSnapshot()
  const navigate = useAppNavigate()
  const decision = gateDecision(status)
  const authenticated = decision === 'universe'
  useEffect(() => {
    if (authenticated) {
      navigate({ to: loginReturnTarget(from) })
    }
  }, [authenticated, from, navigate])
  if (!requiresSignIn(decision)) return <AuthHold />
  return (
    <LoginPage
      onModeChange={() => navigate({ to: '/signup' })}
      onTryDemo={() => navigate({ to: '/demo' })}
      onAbout={() => navigate({ to: '/about' })}
    />
  )
}

/** `/` — the origin root is the way in. No `from`: nobody was sent here from anywhere. */
export function EntryRoute() {
  return <EntryDoor />
}

/** `/login` — the same door, carrying the route the guard turned away. */
export function LoginRoute() {
  const search = useSearch({ strict: false }) as { from?: string }
  return <EntryDoor from={search.from} />
}

export function SignupRoute() {
  const { status } = useSessionSnapshot()
  const navigate = useAppNavigate()
  const decision = gateDecision(status)
  useEffect(() => {
    if (decision === 'universe') navigate({ to: '/universe' })
  }, [decision, navigate])
  // Signed-out only, for the reason `EntryDoor` states: the bounce is an effect, so anyone already
  // inside would otherwise be shown a signup form for the frame before it runs.
  if (!requiresSignIn(decision)) return <AuthHold />
  return (
    <LoginPage
      mode="signUp"
      onModeChange={() => navigate({ to: '/login' })}
      onTryDemo={() => navigate({ to: '/demo' })}
      onAbout={() => navigate({ to: '/about' })}
    />
  )
}

export function InviteRoute() {
  const { token } = useParams({ strict: false }) as { token: string }
  const { status } = useSessionSnapshot()
  const navigate = useAppNavigate()
  const decision = gateDecision(status)

  useEffect(() => {
    pendingInvite.capture(token)
    navigate({ to: '/signup', replace: true })
  }, [navigate, token])

  useEffect(() => {
    if (decision === 'universe') navigate({ to: '/universe', replace: true })
  }, [decision, navigate])
  return <AuthHold />
}
