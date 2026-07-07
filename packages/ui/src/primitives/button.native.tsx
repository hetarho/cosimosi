import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { ButtonColor, ButtonOwnProps, ControlSize } from './types.ts'

export type ButtonProps = ButtonOwnProps & Omit<PressableProps, 'children' | 'style'> & { style?: StyleProp<ViewStyle> }

// Two axes on native too (no glass/blur — RN can't; solid fill / border / bare approximates it).
// CONTAINED_* is the filled look per colour; INK is the label/border colour for outlined + text.
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
// Outlined border: the accent, except neutral falls back to the neutral border token.
const OUTLINE_BORDER: Record<ButtonColor, string> = {
  primary: color.primary,
  secondary: color.secondary,
  tertiary: color.tertiary,
  neutral: color.border,
  danger: color.danger,
}

const HEIGHT: Record<ControlSize, number> = { sm: 32, md: 40, lg: 48 }
const PAD_X: Record<ControlSize, number> = { sm: space[3], md: space[4], lg: space[5] }
const FONT: Record<ControlSize, number> = { sm: fontSize.sm, md: fontSize.base, lg: fontSize.lg }

export function Button({
  variant = 'contained',
  color: colorRole = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leadingIcon,
  trailingIcon,
  children,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  const bg = variant === 'contained' ? CONTAINED_BG[colorRole] : 'transparent'
  const fg = variant === 'contained' ? CONTAINED_FG[colorRole] : INK[colorRole]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: bg, height: HEIGHT[size], paddingHorizontal: PAD_X[size] },
        variant === 'outlined' && { borderWidth: 1, borderColor: OUTLINE_BORDER[colorRole] },
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : leadingIcon}
      <Text style={{ color: fg, fontSize: FONT[size], fontWeight: '500' }}>{children}</Text>
      {loading ? null : trailingIcon}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], borderRadius: radius.md },
  disabled: { opacity: 0.5 },
})
