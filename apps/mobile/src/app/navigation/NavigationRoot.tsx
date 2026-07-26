import { useEffect, useRef, useState } from 'react'

import {
  createNavigationContainerRef,
  NavigationContainer,
  useIsFocused,
  type LinkingOptions,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { gateDecision, pendingInvite } from '@cosimosi/auth'

import { DiaryReaderPage } from '../../pages/diary-reader/index.ts'
import { LoginPage } from '../../pages/login/index.ts'
import { MePage } from '../../pages/me/index.ts'
import { TestPage } from '../../pages/test/index.ts'
import { UniversePage } from '../../pages/universe/index.ts'
import {
  isAuthCallbackUrl,
  isInviteUrl,
  mobileLinkingPrefixes,
  subscribeToInviteUrls,
} from '../../shared/native/index.ts'
import { DiagnosticsScreen } from '../diagnostics/index.ts'
import {
  MobileLocaleBootstrap,
  MobilePaletteBootstrap,
  MobileProfileGate,
  useSessionSnapshot,
} from '../providers/index.ts'
import { ROUTES, type RootStackParamList, type RootStackScreenProps } from './routes.ts'
import { BootScreen } from './screens/BootScreen.tsx'

const Stack = createNativeStackNavigator<RootStackParamList>()
const navigationRef = createNavigationContainerRef<RootStackParamList>()

function UniverseRoute({ navigation }: RootStackScreenProps<'Universe'>) {
  const active = useIsFocused()
  return (
    <UniversePage
      active={active}
      onOpenDiary={() => navigation.navigate(ROUTES.diaryReader)}
      onOpenMe={() => navigation.navigate(ROUTES.me)}
    />
  )
}

function DiaryReaderRoute({ navigation }: RootStackScreenProps<'DiaryReader'>) {
  const active = useIsFocused()
  return <DiaryReaderPage active={active} onExit={() => navigation.navigate(ROUTES.universe)} />
}

function MeRoute({ navigation }: RootStackScreenProps<'Me'>) {
  return <MePage onBack={() => navigation.navigate(ROUTES.universe)} />
}

function TestRoute({ navigation }: RootStackScreenProps<'Test'>) {
  return <TestPage onBack={() => navigation.navigate(ROUTES.universe)} />
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
 * The mobile auth gate ([U1][U4], §3.5): the authoritative stack is selected from the [04] session
 * snapshot via the same status→decision mapping the web `/` guard uses — a settled signed-out
 * (`signedOut`/`signingIn`/`expired`/`failed`) → the login stack; the initial `bootstrapping` → the
 * neutral splash (no signed-out flash); `authenticated` and `refreshing` → the universe stack. A
 * `refreshing` session is provisionally authenticated, so a token refresh keeps the universe stack
 * mounted ("hold in place", no blank). React Navigation swaps the mounted stack whenever the choice
 * changes, so sign-in lands on the universe and sign-out returns to login with no manual reset — and
 * the universe (and its `GetUniverse` read) never mount without a session. There is no landing route
 * between login and the universe (v1). The nav library stays confined to this segment.
 */
export function NavigationRoot({ linking = mobileLinking }: NavigationRootProps = {}) {
  const { status } = useSessionSnapshot()
  const statusRef = useRef(status)
  statusRef.current = status
  const [inviteEntry, setInviteEntry] = useState(() => pendingInvite.peek() !== null)
  // Settled signed-out routes to login; the initial bootstrap holds on the splash; otherwise
  // (authenticated or a provisionally-authenticated refresh) the universe stack stays mounted.
  const stack =
    gateDecision(status) === 'login' ? 'login' : status === 'bootstrapping' ? 'splash' : 'universe'

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
    <NavigationContainer ref={navigationRef} linking={linking ?? undefined}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {stack === 'universe' ? (
          <>
            <Stack.Screen name={ROUTES.universe} component={UniverseRoute} />
            <Stack.Screen name={ROUTES.diaryReader} component={DiaryReaderRoute} />
            <Stack.Screen name={ROUTES.me} component={MeRoute} />
            <Stack.Screen name={ROUTES.diagnostics} component={DiagnosticsScreen} />
            <Stack.Screen name={ROUTES.test} component={TestRoute} />
          </>
        ) : stack === 'login' ? (
          inviteEntry ? (
            <>
              <Stack.Screen name={ROUTES.signUp} component={SignUpRoute} />
              <Stack.Screen name={ROUTES.login} component={LoginRoute} />
            </>
          ) : (
            <>
              <Stack.Screen name={ROUTES.login} component={LoginRoute} />
              <Stack.Screen name={ROUTES.signUp} component={SignUpRoute} />
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
      <MobileLocaleBootstrap />
      <MobilePaletteBootstrap>{navigation}</MobilePaletteBootstrap>
    </MobileProfileGate>
  ) : (
    navigation
  )
}
