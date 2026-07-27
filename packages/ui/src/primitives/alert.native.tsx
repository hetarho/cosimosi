import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { oklchToRnColor } from '../lib/oklch.ts'
import { color, fontSize, radius, space } from '../native-styles.ts'
import { tokens } from '../tokens.ts'
import type { AlertOwnProps, AlertVariant } from './types.ts'

export type AlertProps = AlertOwnProps & { style?: StyleProp<ViewStyle> }

// The inline alert (web parity): the status hue on the rim over a whisper of the same hue, the copy
// in plain ink. RN has no color-mix, so the two mixes are resolved from the same OKLCH token through
// `oklchToRnColor` — the weights match the web recipe rather than approximating it with a
// full-strength rim.
const ROLE: Record<AlertVariant, string> = {
  info: tokens.color.primary,
  success: tokens.color.success,
  warning: tokens.color.warning,
  danger: tokens.color.danger,
}

const rim = (variant: AlertVariant) => oklchToRnColor(ROLE[variant], 0.5)
const fill = (variant: AlertVariant) => oklchToRnColor(ROLE[variant], 0.1)

export function Alert({ variant = 'danger', live = 'alert', children, style }: AlertProps) {
  return (
    <View
      accessibilityRole={live === 'alert' ? 'alert' : undefined}
      accessibilityLiveRegion={live === 'alert' ? 'assertive' : 'polite'}
      style={[styles.base, { borderColor: rim(variant), backgroundColor: fill(variant) }, style]}
    >
      <Text style={styles.text}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  text: { color: color['text-muted'], fontSize: fontSize.sm, lineHeight: 24 },
})
