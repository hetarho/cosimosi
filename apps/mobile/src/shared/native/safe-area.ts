import { useContext } from 'react'

import {
  initialWindowMetrics,
  SafeAreaInsetsContext,
  type EdgeInsets,
  type Metrics,
} from 'react-native-safe-area-context'

/**
 * Safe-area seam (ARCHITECTURE §3.5). The shell handles device chrome so feature
 * slices never deal with the library directly. `initialWindowMetrics` is null before the
 * native view measures (and always null in host tests) — `fallbackSafeAreaMetrics`
 * lets `SafeAreaProvider` render its children synchronously in that case.
 */
export const fallbackSafeAreaMetrics: Metrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
}

export const resolvedSafeAreaMetrics: Metrics = initialWindowMetrics ?? fallbackSafeAreaMetrics

/**
 * The live insets a screen must clear — the status bar and dynamic island above, the home indicator
 * below. A screen that pads by a guessed constant instead reads fine on the device it was written on
 * and hides its own title on the next one; that is what happened to every top-chrome header here.
 * Wrapped so `pages` consume the seam rather than the library (§3.5), and so a host test that mounts
 * without the provider still gets zeroes instead of throwing.
 */
export function useScreenInsets(): EdgeInsets {
  // The context, not `useSafeAreaInsets` — that hook throws when no provider is above it, which
  // would turn every widget test that mounts a screen fragment into a failure about device chrome.
  // Zero insets are the right answer there: no device, no chrome to clear.
  return useContext(SafeAreaInsetsContext) ?? fallbackSafeAreaMetrics.insets
}
