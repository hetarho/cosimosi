import { useSyncExternalStore } from 'react'

import {
  getThemeState,
  setBackground,
  setTheme,
  subscribeTheme,
  type BackgroundState,
  type ThemeName,
  type ThemeState,
} from './theme-store.ts'

export interface UseThemeResult extends ThemeState {
  setTheme: (theme: ThemeName) => void
  setBackground: (background: BackgroundState) => void
}

/**
 * Read the theme/background seam reactively. Re-renders the caller when the
 * presentation state changes. The same hook runs on web and React Native; only
 * how each app *applies* the state to its surface differs (CSS variables vs RN
 * style props), which is an app-boundary concern.
 */
export function useTheme(): UseThemeResult {
  const state = useSyncExternalStore(subscribeTheme, getThemeState, getThemeState)
  return { ...state, setTheme, setBackground }
}
