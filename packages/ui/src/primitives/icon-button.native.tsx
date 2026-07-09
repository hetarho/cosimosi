import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { color, radius } from '../native-styles.ts'
import type { ButtonColor, ControlSize, IconButtonOwnProps } from './types.ts'

export type IconButtonProps = IconButtonOwnProps &
  Omit<PressableProps, 'children' | 'accessibilityLabel' | 'style'> & {
    style?: StyleProp<ViewStyle>
  }

// Mirrors button.native's two-axis model (appearance × colour).
const CONTAINED_BG: Record<ButtonColor, string> = {
  primary: color.primary,
  secondary: color.secondary,
  tertiary: color.tertiary,
  neutral: color['surface-raised'],
  danger: color.danger,
}
const CONTAINED_FG: Record<ButtonColor, string> = {
  primary: color['primary-foreground'],
  secondary: color['secondary-foreground'],
  tertiary: color['tertiary-foreground'],
  neutral: color.text,
  danger: color['danger-foreground'],
}
const INK: Record<ButtonColor, string> = {
  primary: color.primary,
  secondary: color.secondary,
  tertiary: color.tertiary,
  neutral: color.text,
  danger: color.danger,
}
const OUTLINE_BORDER: Record<ButtonColor, string> = {
  primary: color.primary,
  secondary: color.secondary,
  tertiary: color.tertiary,
  neutral: color.border,
  danger: color.danger,
}

const SIDE: Record<ControlSize, number> = { sm: 32, md: 40, lg: 48 }

export function IconButton({
  variant = 'text',
  color: colorRole = 'neutral',
  size = 'md',
  loading = false,
  disabled,
  label,
  icon,
  style,
  ...rest
}: IconButtonProps) {
  const isDisabled = disabled || loading
  const bg = variant === 'contained' ? CONTAINED_BG[colorRole] : 'transparent'
  const fg = variant === 'contained' ? CONTAINED_FG[colorRole] : INK[colorRole]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: bg, width: SIDE[size], height: SIDE[size] },
        variant === 'outlined' && { borderWidth: 1, borderColor: OUTLINE_BORDER[colorRole] },
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  disabled: { opacity: 0.5 },
})
