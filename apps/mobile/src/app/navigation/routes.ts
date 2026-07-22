import type { NativeStackScreenProps } from '@react-navigation/native-stack'

/**
 * Typed route registry for the mobile shell. This file and NavigationRoot are the
 * only places that know the navigation library. The shell owns
 * navigation infrastructure, not product composition: product pages are imported by
 * NavigationRoot and adapted to this typed boundary through callback/data props.
 */
export const ROUTES = {
  /** Neutral splash held while the session seam settles (bootstrapping/refreshing). */
  boot: 'Boot',
  /** The sign-in entry — the unauthenticated default; there is no landing route before it. */
  login: 'Login',
  /** Dev-only provider health surface (gated by the diagnostics flag; deep-link reachable). */
  diagnostics: 'Diagnostics',
  /** Dev-only on-device design showcase (gated by the diagnostics flag; deep-link reachable). */
  test: 'Test',
  /** The 3D memory universe — the shared @cosimosi/3d-renderer scene; the authenticated default. */
  universe: 'Universe',
  /** The immutable diary archive — the quiet keeping-place ([D2]). */
  diaryReader: 'DiaryReader',
  /** The one settings surface — account · palette · the reserved staging slot ([52]). */
  settings: 'Settings',
} as const

export type RootStackParamList = {
  Boot: undefined
  Login: undefined
  Diagnostics: undefined
  Test: undefined
  Universe: undefined
  DiaryReader: undefined
  Settings: undefined
}

export type RootStackScreenProps<RouteName extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, RouteName>

declare global {
  // Makes the typed param list the default for navigation hooks app-wide.
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
