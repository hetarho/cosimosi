import { NavigationContainer, type LinkingOptions } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { mobileLinkingPrefixes } from '../../shared/native/index.ts'
import { DiagnosticsScreen } from '../diagnostics/index.ts'
import { ROUTES, type RootStackParamList } from './routes.ts'
import { BootScreen } from './screens/BootScreen.tsx'
import { ShellHomeScreen } from './screens/ShellHomeScreen.tsx'
import { UniverseScreen } from './screens/UniverseScreen.tsx'

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * Typed deep-link config built from the inbound-link seam's prefixes. Boot is
 * intentionally excluded — it is a transient route, never a link target. Kept
 * module-private so the navigation library stays confined to this layer.
 */
const mobileLinking: LinkingOptions<RootStackParamList> = {
  prefixes: [...mobileLinkingPrefixes],
  config: {
    screens: {
      [ROUTES.shellHome]: 'home',
      [ROUTES.diagnostics]: 'diagnostics',
      [ROUTES.universe]: 'universe',
    },
  },
}

export interface NavigationRootProps {
  /** Override/disable deep linking (host tests pass `null` to skip the native path). */
  linking?: LinkingOptions<RootStackParamList> | null
}

export function NavigationRoot({ linking = mobileLinking }: NavigationRootProps = {}) {
  return (
    <NavigationContainer linking={linking ?? undefined}>
      <Stack.Navigator initialRouteName={ROUTES.boot} screenOptions={{ headerShown: false }}>
        <Stack.Screen name={ROUTES.boot} component={BootScreen} />
        <Stack.Screen name={ROUTES.shellHome} component={ShellHomeScreen} />
        <Stack.Screen name={ROUTES.diagnostics} component={DiagnosticsScreen} />
        <Stack.Screen name={ROUTES.universe} component={UniverseScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
