import { View } from 'react-native'

import { color, radius } from '../native-styles.ts'
import type { ProgressOwnProps } from './types.ts'

export type ProgressProps = ProgressOwnProps

// The native meter. `accessibilityValue` carries the same verbatim pair the web primitive announces,
// so the two platforms report identically to assistive tech.
export function Progress({ value, max, ariaLabel }: ProgressProps) {
  // One bounded max for BOTH the geometry and the announcement, matching the web primitive exactly.
  const boundedMax = Math.max(max, 0)
  const bounded = boundedMax === 0 ? 0 : Math.min(Math.max(value, 0), boundedMax)
  const ratio = boundedMax > 0 ? bounded / boundedMax : 1
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={ariaLabel}
      accessibilityValue={{ now: boundedMax === 0 ? boundedMax : bounded, min: 0, max: boundedMax }}
      style={{
        height: 6,
        width: '100%',
        borderRadius: radius.full,
        backgroundColor: color['surface-raised'],
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${ratio * 100}%`,
          borderRadius: radius.full,
          backgroundColor: ratio >= 1 ? color.success : color.primary,
        }}
      />
    </View>
  )
}
