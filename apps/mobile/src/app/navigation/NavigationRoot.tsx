import { NavigationContainer, type LinkingOptions } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { gateDecision } from '@cosimosi/auth'

import { mobileLinkingPrefixes } from '../../shared/native/index.ts'
import { DiagnosticsScreen } from '../diagnostics/index.ts'
import { useSessionSnapshot } from '../providers/index.ts'
import { ROUTES, type RootStackParamList } from './routes.ts'
import { BootScreen } from './screens/BootScreen.tsx'
import { DiaryReaderScreen } from './screens/DiaryReaderScreen.tsx'
import { LoginScreen } from './screens/LoginScreen.tsx'
import { UniverseScreen } from './screens/UniverseScreen.tsx'

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * Typed deep-link config built from the inbound-link seam's prefixes. Only the authenticated
 * stack's screens are link targets; the transient splash and the login entry are never linked to.
 * Kept module-private so the navigation library stays confined to this layer.
 */
const mobileLinking: LinkingOptions<RootStackParamList> = {
  prefixes: [...mobileLinkingPrefixes],
  config: {
    screens: {
      [ROUTES.diagnostics]: 'diagnostics',
      [ROUTES.universe]: 'universe',
      [ROUTES.diaryReader]: 'diary',
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
  return (
    <NavigationContainer linking={linking ?? undefined}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {stack === 'universe' ? (
          <>
            <Stack.Screen name={ROUTES.universe} component={UniverseScreen} />
            <Stack.Screen name={ROUTES.diaryReader} component={DiaryReaderScreen} />
            <Stack.Screen name={ROUTES.diagnostics} component={DiagnosticsScreen} />
          </>
        ) : stack === 'login' ? (
          <Stack.Screen name={ROUTES.login} component={LoginScreen} />
        ) : (
          <Stack.Screen name={ROUTES.boot} component={BootScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
