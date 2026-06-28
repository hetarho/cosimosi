import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { ButtonOwnProps, ButtonVariant, ControlSize } from './types.ts'

export type ButtonProps = ButtonOwnProps & Omit<PressableProps, 'children' | 'style'> & { style?: StyleProp<ViewStyle> }

const BG: Record<ButtonVariant, string> = {
  primary: color.primary,
  secondary: color['surface-raised'],
  ghost: 'transparent',
  danger: color.danger,
}

const FG: Record<ButtonVariant, string> = {
  primary: color['primary-foreground'],
  secondary: color.text,
  ghost: color.text,
  danger: color['danger-foreground'],
}

const HEIGHT: Record<ControlSize, number> = { sm: 32, md: 40, lg: 48 }
const PAD_X: Record<ControlSize, number> = { sm: space[3], md: space[4], lg: space[5] }
const FONT: Record<ControlSize, number> = { sm: fontSize.sm, md: fontSize.base, lg: fontSize.lg }

export function Button({
  variant = 'primary',
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: BG[variant], height: HEIGHT[size], paddingHorizontal: PAD_X[size] },
        variant === 'secondary' && styles.bordered,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={FG[variant]} /> : leadingIcon}
      <Text style={{ color: FG[variant], fontSize: FONT[size], fontWeight: '500' }}>{children}</Text>
      {loading ? null : trailingIcon}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], borderRadius: radius.md },
  bordered: { borderWidth: 1, borderColor: color.border },
  disabled: { opacity: 0.5 },
})
