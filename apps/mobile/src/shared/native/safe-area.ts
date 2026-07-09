import { initialWindowMetrics, type Metrics } from 'react-native-safe-area-context'

/**
 * Safe-area seam (ARCHITECTURE §3.5). The shell handles device chrome so feature
 * slices never deal with insets directly. `initialWindowMetrics` is null before the
 * native view measures (and always null in host tests) — `fallbackSafeAreaMetrics`
 * lets `SafeAreaProvider` render its children synchronously in that case.
 */
export const fallbackSafeAreaMetrics: Metrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
}

export const resolvedSafeAreaMetrics: Metrics = initialWindowMetrics ?? fallbackSafeAreaMetrics
