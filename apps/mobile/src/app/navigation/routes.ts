import type { NativeStackScreenProps } from '@react-navigation/native-stack'

/**
 * Typed route registry for the mobile shell. This file and NavigationRoot are the
 * only places that know the navigation library. The shell owns
 * navigation infrastructure, not product IA: the route set is deliberately small
 * and non-product. Feature screens are added later by presentation plans through
 * this same typed boundary.
 */
export const ROUTES = {
  /** Transient state while session/i18n/theme seams settle. */
  boot: 'Boot',
  /** Neutral placeholder confirming the shell is ready. */
  shellHome: 'ShellHome',
  /** Dev-only provider health surface (gated by the diagnostics flag). */
  diagnostics: 'Diagnostics',
  /** The 3D memory universe — the shared @cosimosi/3d-renderer scene. */
  universe: 'Universe',
} as const

export type RootStackParamList = {
  Boot: undefined
  ShellHome: undefined
  Diagnostics: undefined
  Universe: undefined
}

export type RootStackScreenProps<RouteName extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, RouteName>

declare global {
  // Makes the typed param list the default for navigation hooks app-wide.
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
