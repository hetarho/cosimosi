import { StyleSheet, Text, View } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { BadgeOwnProps, BadgeVariant } from './types.ts'

export type BadgeProps = BadgeOwnProps

const BG: Record<BadgeVariant, string> = {
  neutral: color['surface-raised'],
  primary: color.primary,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
}

const FG: Record<BadgeVariant, string> = {
  neutral: color['text-muted'],
  primary: color['primary-foreground'],
  success: color['success-foreground'],
  warning: color['warning-foreground'],
  danger: color['danger-foreground'],
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: BG[variant] }]}>
      <Text style={[styles.text, { color: FG[variant] }]}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  text: { fontSize: fontSize.xs, fontWeight: '500' },
})
