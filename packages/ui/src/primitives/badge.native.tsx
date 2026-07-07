import { StyleSheet, Text, View } from 'react-native'

import { color, fontSize, radius } from '../native-styles.ts'
import type { BadgeOwnProps, BadgeVariant } from './types.ts'

export type BadgeProps = BadgeOwnProps

// Outline-first chips (web parity): the variant colour lives on the BORDER + TEXT, not a solid fill.
// RN has no backdrop-filter, so the glass material is approximated with a quiet elevated surface and
// the rim + text carry the hue (mirrors the web `.badge` outline recipe).
const BORDER: Record<BadgeVariant, string> = {
  neutral: color.border,
  primary: color.primary,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
}

const FG: Record<BadgeVariant, string> = {
  neutral: color['text-muted'],
  primary: color.primary,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <View style={[styles.badge, { borderColor: BORDER[variant] }]}>
      <Text style={[styles.text, { color: FG[variant] }]}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    backgroundColor: color['surface-raised'],
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontSize: fontSize.xs, fontWeight: '500', lineHeight: 15 },
})
