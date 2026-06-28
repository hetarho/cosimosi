import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'

import { color, radius } from '../native-styles.ts'
import type { ButtonVariant, ControlSize, IconButtonOwnProps } from './types.ts'

export type IconButtonProps = IconButtonOwnProps &
  Omit<PressableProps, 'children' | 'accessibilityLabel' | 'style'> & { style?: StyleProp<ViewStyle> }

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

const SIDE: Record<ControlSize, number> = { sm: 32, md: 40, lg: 48 }

export function IconButton({
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled,
  label,
  icon,
  style,
  ...rest
}: IconButtonProps) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: BG[variant], width: SIDE[size], height: SIDE[size] },
        variant === 'secondary' && styles.bordered,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={FG[variant]} /> : icon}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  bordered: { borderWidth: 1, borderColor: color.border },
  disabled: { opacity: 0.5 },
})
