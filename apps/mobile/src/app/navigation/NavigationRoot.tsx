import { useEffect, useRef, useState } from 'react'

import {
  createNavigationContainerRef,
  DarkTheme,
  NavigationContainer,
  useIsFocused,
  type LinkingOptions,
  type Theme,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { gateDecision, pendingInvite, requiresSignIn } from '@cosimosi/auth'
import { tokens } from '@cosimosi/ui'

import { DesignShowcasePage } from '../../pages/design/index.ts'
import { DiaryReaderPage } from '../../pages/diary-reader/index.ts'
import { LoginPage } from '../../pages/login/index.ts'
import { MePage } from '../../pages/me/index.ts'
import { TestPage } from '../../pages/test/index.ts'
import { UniversePage } from '../../pages/universe/index.ts'
import { LocaleBootstrap } from '../../shared/i18n/index.ts'
import {
  isAuthCallbackUrl,
  isInviteUrl,
  mobileLinkingPrefixes,
  subscribeToInviteUrls,
} from '../../shared/native/index.ts'
import { DiagnosticsScreen } from '../diagnostics/index.ts'
import {
  MobileDecorationBootstrap,
  MobileProfileGate,
  useSessionSnapshot,
} from '../providers/index.ts'
import { ROUTES, type RootStackParamList, type RootStackScreenProps } from './routes.ts'
import { BootScreen } from './screens/BootScreen.tsx'
import { AchievementNoticeHost } from '../../features/achievement-notice/index.ts'

/**
 * The navigator's own surface colours, from the design tokens.
 *
 * React Navigation paints a background per screen card from its theme, ABOVE the shell's themed
 * surface — so with its light default a screen that set no background of its own came up as the
 * library's grey, with our near-white ink on top of it. That is not something a screen can fix from
 * the inside; the container is where the ground belongs.
 */
const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: tokens.color.bg,
    card: tokens.color.surface,
    text: tokens.color.text,
    border: tokens.color.border,
    primary: tokens.color.primary,
    notification: tokens.color.danger,
  },
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const navigationRef = createNavigationContainerRef<RootStackParamList>()

function UniverseRoute({ navigation }: RootStackScreenProps<'Universe'>) {
  const active = useIsFocused()
  return (
    <UniversePage
      active={active}
      onOpenDiary={() => navigation.navigate(ROUTES.diaryReader)}
      onOpenMe={() => navigation.navigate(ROUTES.me)}
      // Where earning is actually claimed ([A4]) — the shell owns the tab id because it owns the
      // route; the page and the widget below it know only the intent.
      onOpenAchievements={() => navigation.navigate(ROUTES.me, { tab: 'achievements' })}
    />
  )
}

function DiaryReaderRoute({ navigation }: RootStackScreenProps<'DiaryReader'>) {
  const active = useIsFocused()
  return <DiaryReaderPage active={active} onExit={() => navigation.navigate(ROUTES.universe)} />
}

function MeRoute({ navigation, route }: RootStackScreenProps<'Me'>) {
  return (
    <MePage initialTab={route.params?.tab} onBack={() => navigation.navigate(ROUTES.universe)} />
  )
}

function TestRoute({ navigation }: RootStackScreenProps<'Test'>) {
  return <TestPage onBack={() => navigation.navigate(ROUTES.universe)} />
}

// The design showcase is reachable from either stack, so "back" goes wherever the user came from
// rather than assuming a signed-in universe behind it.
function DesignRoute({ navigation }: RootStackScreenProps<'Design'>) {
  return <DesignShowcasePage onBack={() => navigation.goBack()} />
}

function LoginRoute({ navigation }: RootStackScreenProps<'Login'>) {
  return <LoginPage onModeChange={() => navigation.navigate(ROUTES.signUp)} />
}

function SignUpRoute({ navigation }: RootStackScreenProps<'SignUp'>) {
  return <LoginPage mode="signUp" onModeChange={() => navigation.navigate(ROUTES.login)} />
}

/**
 * Typed deep-link config built from the inbound-link seam's prefixes. Only the authenticated
 * stack's screens are link targets; the transient splash and the login entry are never linked to.
 * Kept module-private so the navigation library stays confined to this layer.
 */
const mobileLinking: LinkingOptions<RootStackParamList> = {
  prefixes: [...mobileLinkingPrefixes],
  // The OAuth callback is an auth event, not a screen — the auth provider's
  // subscription consumes it; letting it through would log an unmatched-route warning.
  filter: (url) => !isAuthCallbackUrl(url) && !isInviteUrl(url),
  config: {
    screens: {
      [ROUTES.diagnostics]: 'diagnostics',
      [ROUTES.test]: 'test',
      [ROUTES.design]: 'design',
      [ROUTES.universe]: 'universe',
      [ROUTES.diaryReader]: 'diary',
      [ROUTES.me]: 'me',
    },
  },
}

export interface NavigationRootProps {
  /** Override/disable deep linking (host tests pass `null` to skip the native path). */
  linking?: LinkingOptions<RootStackParamList> | null
}

/**
 * The mobile auth gate ([U1][U4], §3.5): the authoritative stack is selected from the auth session
 * snapshot via the same status→decision mapping the web `/` guard uses — a settled signed-out
 * (`signedOut`/`signingIn`/`expired`/`failed`) → the login stack; the initial `bootstrapping` → the
 * neutral splash (no signed-out flash); `authenticated` and `refreshing` → the universe stack. A
 * `refreshing` session is provisionally authenticated, so a token refresh keeps the universe stack
 * mounted ("hold in place", no blank). React Navigation swaps the mounted stack whenever the choice
 * changes, so sign-in lands on the universe and sign-out returns to login with no manual reset — and
 * the universe (and its `GetUniverse` read) never mount without a session.
 *
 * The web's marketing page has no native counterpart, by a stated waiver: a person who installed the
 * app has already converted. Since the web root became the door too, every signed-out status maps to
 * the login stack on both platforms — and this still asks `requiresSignIn` rather than comparing to
 * `'login'`, so the day a fourth gate decision arrives this line refuses to compile instead of quietly
 * sending a signed-out visitor into the universe stack. The nav library stays confined to this segment.
 */
export function NavigationRoot({ linking = mobileLinking }: NavigationRootProps = {}) {
  const { status } = useSessionSnapshot()
  const statusRef = useRef(status)
  statusRef.current = status
  const [inviteEntry, setInviteEntry] = useState(() => pendingInvite.peek() !== null)
  // Settled signed-out routes to login; the initial bootstrap holds on the splash; otherwise
  // (authenticated or a provisionally-authenticated refresh) the universe stack stays mounted.
  const stack = requiresSignIn(gateDecision(status))
    ? 'login'
    : status === 'bootstrapping'
      ? 'splash'
      : 'universe'

  useEffect(
    () =>
      subscribeToInviteUrls((token) => {
        pendingInvite.capture(token)
        if (statusRef.current === 'authenticated' || statusRef.current === 'refreshing') {
          pendingInvite.clear()
          return
        }
        setInviteEntry(true)
      }),
    [],
  )

  useEffect(() => {
    if (!inviteEntry || stack !== 'login' || !navigationRef.isReady()) return
    navigationRef.resetRoot({ index: 0, routes: [{ name: ROUTES.signUp }] })
  }, [inviteEntry, stack])

  useEffect(() => {
    if (stack === 'universe') setInviteEntry(false)
  }, [stack])

  const navigation = (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} linking={linking ?? undefined}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {stack === 'universe' ? (
          <>
            <Stack.Screen name={ROUTES.universe} component={UniverseRoute} />
            <Stack.Screen name={ROUTES.diaryReader} component={DiaryReaderRoute} />
            <Stack.Screen name={ROUTES.me} component={MeRoute} />
            <Stack.Screen name={ROUTES.diagnostics} component={DiagnosticsScreen} />
            <Stack.Screen name={ROUTES.test} component={TestRoute} />
            <Stack.Screen name={ROUTES.design} component={DesignRoute} />
          </>
        ) : stack === 'login' ? (
          inviteEntry ? (
            <>
              <Stack.Screen name={ROUTES.signUp} component={SignUpRoute} />
              <Stack.Screen name={ROUTES.login} component={LoginRoute} />
              <Stack.Screen name={ROUTES.design} component={DesignRoute} />
            </>
          ) : (
            <>
              <Stack.Screen name={ROUTES.login} component={LoginRoute} />
              <Stack.Screen name={ROUTES.signUp} component={SignUpRoute} />
              <Stack.Screen name={ROUTES.design} component={DesignRoute} />
            </>
          )
        ) : (
          <Stack.Screen name={ROUTES.boot} component={BootScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
  return stack === 'universe' ? (
    <MobileProfileGate>
      <LocaleBootstrap />
      {/* Mounted in the authenticated branch and nowhere else. That one placement is three guards at
          once: a signed-out visitor never fetches ListAchievements, no unauthenticated stack can
          mount the watcher, and sign-out unmounts the snapshot the diff compares against. */}
      <AchievementNoticeHost />
      <MobileDecorationBootstrap>{navigation}</MobileDecorationBootstrap>
    </MobileProfileGate>
  ) : (
    navigation
  )
}
