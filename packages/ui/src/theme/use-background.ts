import { useSyncExternalStore } from 'react'

import {
  getBackgroundState,
  setBackground,
  subscribeBackground,
  type BackgroundState,
} from './background-store.ts'

export interface UseBackgroundResult {
  background: BackgroundState
  setBackground: (background: BackgroundState) => void
}

/**
 * Read the background seam reactively. Re-renders the caller when the presentation state changes.
 * The same hook runs on web and React Native; only how each app *applies* the state to its surface
 * differs (CSS variables vs RN style props), which is an app-boundary concern.
 */
export function useBackground(): UseBackgroundResult {
  const background = useSyncExternalStore(
    subscribeBackground,
    getBackgroundState,
    getBackgroundState,
  )
  return { background, setBackground }
}
