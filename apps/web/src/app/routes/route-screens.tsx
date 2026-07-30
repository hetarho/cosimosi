import { useCallback, useEffect, useMemo } from 'react'

import { Outlet, useLocation, useParams, useSearch } from '@tanstack/react-router'

import { gateDecision, pendingInvite, requiresSignIn } from '@cosimosi/auth'
import type { DiaryConditionsUpdate } from '@cosimosi/universe/react'
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
import { AdminPage } from '../../pages/admin/index.ts'
import { DemoPage } from '../../pages/demo/index.ts'
import { BlogNotFoundPage } from '../../pages/blog-not-found/index.ts'
import { LandingPage } from '../../pages/landing/index.ts'
import { DiaryReaderPage } from '../../pages/diary-reader/index.ts'
import { diaryQueryFromSearch, searchWithUpdate, type DiarySearchParams } from './diary-search.ts'
import { LoginPage } from '../../pages/login/index.ts'
import { MePage, parseMeTab, type MeTabId } from '../../pages/me/index.ts'
import { UniverseHomePage } from '../../pages/universe/index.ts'
import { writeStoredLocale } from '../../shared/lib/locale-storage.ts'
import { loginReturnTarget } from './guards/auth-gate.ts'
import { useAppNavigate } from './navigation.ts'
import { AchievementNoticeHost } from '../../features/achievement-notice/index.ts'

// The route components live apart from the route-tree config so this file exports
// components only (react-refresh's only-export-components contract); route-tree.tsx
// owns the createRoute wiring and the non-component exports.

// The neutral hold shown while the session is bootstrapping/refreshing — no signed-out flash and no
// landing flash either, which is the whole reason `'hold'` survived the front door: a returning user
// mid-refresh must not be shown marketing for a frame.
export function AuthHold() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background text-text-muted">
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

// `/` is the app's single decision point, so no URL means two things at once: a signed-out visitor gets
// the front door, an authenticated one is forwarded to their universe, and a session still settling
// holds neutrally rather than flashing either surface ([U4]).
//
// The page takes its two destinations and the locale seam as callbacks, because `pages` may not import
// `app` (§3.1) — `setActiveLocale` plus persistence lives up here with the rest of the i18n wiring, and
// the page just says which of the two locales the visitor chose.
export function LandingRoute() {
  const { status } = useSessionSnapshot()
  const navigate = useAppNavigate()
  const locale = useActiveLocale()
  const decision = gateDecision(status)
  useEffect(() => {
    if (decision === 'universe') navigate({ to: '/universe' })
    else if (decision === 'login') navigate({ to: '/login' })
  }, [decision, navigate])
  const onSelectLocale = useCallback((next: Locale) => {
    setActiveLocale(next)
    writeStoredLocale(next)
  }, [])
  if (decision !== 'landing') return <AuthHold />
  return (
    <LandingPage
      locale={locale}
      onSelectLocale={onSelectLocale}
      onTryDemo={() => navigate({ to: '/demo' })}
      onSignUp={() => navigate({ to: '/signup' })}
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

// The router seam stays confined to this segment: the universe/reader surfaces navigate between
// each other through callbacks these app-layer route components supply, so no page or widget
// imports the router. Named components (not inline arrows) so the navigation hook obeys the
// rules-of-hooks. The universe lives at '/universe'; the archive is its own ('/diary').
export function UniverseRoute() {
  const navigate = useAppNavigate()
  return (
    <UniverseHomePage
      onOpenReader={() => navigate({ to: '/diary' })}
      onOpenMe={() => navigate({ to: '/me', search: { tab: 'profile' } })}
      // Where earning is actually claimed ([A4]) — the app layer owns the tab id because it owns the
      // route; the page and the widget below it know only the intent.
      onOpenAchievements={() => navigate({ to: '/me', search: { tab: 'achievements' } })}
    />
  )
}

export function DiaryReaderRoute() {
  const navigate = useAppNavigate()
  const search = useSearch({ strict: false }) as DiarySearchParams
  // Both are held stable across renders because they reach the archive read's query key and the
  // search feature's commit effect: a fresh object or callback on every render would churn both.
  const query = useMemo(() => diaryQueryFromSearch(search), [search])
  // Replace rather than push: a debounced keystroke must not bury the universe under a hundred
  // history entries, while a deliberate Back still leaves the archive ([D7]).
  const onQueryChange = useCallback(
    (update: DiaryConditionsUpdate) =>
      navigate({
        to: '/diary',
        search: (previous: DiarySearchParams) => searchWithUpdate(previous, update),
        replace: true,
      }),
    [navigate],
  )
  // Mounting the calendar must add NO history entry — the toggle is a way of looking, not a place — so the
  // view swap replaces. Stepping a month is a move the reader may want to undo, so it pushes ([D12]).
  const onViewChange = useCallback(
    (view: 'list' | 'calendar') =>
      navigate({
        to: '/diary',
        search: (previous: DiarySearchParams): DiarySearchParams => ({
          ...previous,
          view: view === 'calendar' ? 'calendar' : undefined,
        }),
        replace: true,
      }),
    [navigate],
  )
  const onMonthChange = useCallback(
    (month: string) =>
      navigate({
        to: '/diary',
        search: (previous: DiarySearchParams) => ({ ...previous, month }),
      }),
    [navigate],
  )
  return (
    <DiaryReaderPage
      onExit={() => navigate({ to: '/universe' })}
      query={query}
      onQueryChange={onQueryChange}
      view={search.view === 'calendar' ? 'calendar' : 'list'}
      onViewChange={onViewChange}
      month={search.month}
      onMonthChange={onMonthChange}
    />
  )
}

export function MeRoute() {
  const navigate = useAppNavigate()
  const search = useSearch({ strict: false }) as { tab?: MeTabId }
  return (
    <MePage
      activeTab={parseMeTab(search.tab)}
      onTabChange={(tab) => navigate({ to: '/me', search: { tab }, replace: true })}
      onExit={() => navigate({ to: '/universe' })}
    />
  )
}

// The admin console route (web-only, the admin console). It mounts under the authenticated subtree; the page
// itself gates on GetAdminSelf and sends a non-admin back to the universe (the BE interceptor is
// the authoritative gate — a non-admin's admin.v1 calls are rejected regardless).
export function AdminRoute() {
  const navigate = useAppNavigate()
  return <AdminPage onExit={() => navigate({ to: '/universe' })} />
}

// The public demo route. The only thing the page needs from the router is where the closing CTA
// goes, so it takes a callback and imports no router — the same seam as UniverseRoute/LoginRoute.
// There is no session check here on purpose: the demo is for people who do not have one.
export function DemoRoute() {
  const navigate = useAppNavigate()
  return <DemoPage onSignUp={() => navigate({ to: '/signup' })} />
}

// The login entry: on a successful sign-in the session reaches authenticated, so this returns the
// user to the route they were headed for (the guard's `from`, validated) or the universe. An
// already-signed-in visitor to /login is bounced straight to the universe. While the session is
// still settling (bootstrapping/refreshing) this holds neutrally instead of rendering the form —
// the no-flash rule applies to /login too: a signed-in user opening /login cold must not see a
// sign-in form for a beat before being bounced. `signingIn` keeps the form (that is where the
// pending sign-in lives).
export function LoginRoute() {
  const search = useSearch({ strict: false }) as { from?: string }
  const { status } = useSessionSnapshot()
  const navigate = useAppNavigate()
  const decision = gateDecision(status)
  const authenticated = decision === 'universe'
  useEffect(() => {
    if (authenticated) {
      navigate({ to: loginReturnTarget(search.from) })
    }
  }, [authenticated, search.from, navigate])
  if (decision === 'hold') return <AuthHold />
  return <LoginPage onModeChange={() => navigate({ to: '/signup' })} />
}

export function SignupRoute() {
  const { status } = useSessionSnapshot()
  const navigate = useAppNavigate()
  const decision = gateDecision(status)
  useEffect(() => {
    if (decision === 'universe') navigate({ to: '/universe' })
  }, [decision, navigate])
  if (decision === 'hold') return <AuthHold />
  return <LoginPage mode="signUp" onModeChange={() => navigate({ to: '/login' })} />
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
