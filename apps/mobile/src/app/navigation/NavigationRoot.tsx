import { NavigationContainer, useIsFocused, type LinkingOptions } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { gateDecision } from '@cosimosi/auth'

import { DiaryReaderPage } from '../../pages/diary-reader/index.ts'
import { LoginPage } from '../../pages/login/index.ts'
import { SettingsPage } from '../../pages/settings/index.ts'
import { TestPage } from '../../pages/test/index.ts'
import { UniversePage } from '../../pages/universe/index.ts'
import { isAuthCallbackUrl, mobileLinkingPrefixes } from '../../shared/native/index.ts'
import { DiagnosticsScreen } from '../diagnostics/index.ts'
import { MobilePaletteBootstrap, useSessionSnapshot } from '../providers/index.ts'
import { ROUTES, type RootStackParamList, type RootStackScreenProps } from './routes.ts'
import { BootScreen } from './screens/BootScreen.tsx'

const Stack = createNativeStackNavigator<RootStackParamList>()

function UniverseRoute({ navigation }: RootStackScreenProps<'Universe'>) {
  const active = useIsFocused()
  return (
    <UniversePage
      active={active}
      onOpenDiary={() => navigation.navigate(ROUTES.diaryReader)}
      onOpenSettings={() => navigation.navigate(ROUTES.settings)}
    />
  )
}

function DiaryReaderRoute({ navigation }: RootStackScreenProps<'DiaryReader'>) {
  const active = useIsFocused()
  return <DiaryReaderPage active={active} onExit={() => navigation.navigate(ROUTES.universe)} />
}

function SettingsRoute({ navigation }: RootStackScreenProps<'Settings'>) {
  return <SettingsPage onBack={() => navigation.navigate(ROUTES.universe)} />
}

function TestRoute({ navigation }: RootStackScreenProps<'Test'>) {
  return <TestPage onBack={() => navigation.navigate(ROUTES.universe)} />
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
  filter: (url) => !isAuthCallbackUrl(url),
  config: {
    screens: {
      [ROUTES.diagnostics]: 'diagnostics',
      [ROUTES.test]: 'test',
      [ROUTES.universe]: 'universe',
      [ROUTES.diaryReader]: 'diary',
      [ROUTES.settings]: 'settings',
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
  // Settled signed-out routes to login; the initial bootstrap holds on the splash; otherwise
  // (authenticated or a provisionally-authenticated refresh) the universe stack stays mounted.
  const stack =
    gateDecision(status) === 'login' ? 'login' : status === 'bootstrapping' ? 'splash' : 'universe'
  const navigation = (
    <NavigationContainer linking={linking ?? undefined}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {stack === 'universe' ? (
          <>
            <Stack.Screen name={ROUTES.universe} component={UniverseRoute} />
            <Stack.Screen name={ROUTES.diaryReader} component={DiaryReaderRoute} />
            <Stack.Screen name={ROUTES.settings} component={SettingsRoute} />
            <Stack.Screen name={ROUTES.diagnostics} component={DiagnosticsScreen} />
            <Stack.Screen name={ROUTES.test} component={TestRoute} />
          </>
        ) : stack === 'login' ? (
          <Stack.Screen name={ROUTES.login} component={LoginPage} />
        ) : (
          <Stack.Screen name={ROUTES.boot} component={BootScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
  return stack === 'universe' ? (
    <MobilePaletteBootstrap>{navigation}</MobilePaletteBootstrap>
  ) : (
    navigation
  )
}
