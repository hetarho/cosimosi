import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { oklchToRnColor } from '../lib/oklch.ts'
import { color, radius } from '../native-styles.ts'
import { tokens as rawTokens } from '../tokens.ts'
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
// Outlined rim: the role's INK at the same 45% the web mixes, which for neutral is the near-white
// text token rather than the dark border one. RN has no symmetric box-shadow, so the rim carries
// alone what the web says with a rim plus a halo — the documented platform divergence.
const OUTLINE_BORDER: Record<ButtonColor, string> = {
  primary: color.primary,
  secondary: color.secondary,
  tertiary: color.tertiary,
  neutral: oklchToRnColor(rawTokens.color.text, 0.45),
  danger: color.danger,
}

const SIDE: Record<ControlSize, number> = { sm: 32, md: 40, lg: 48 }

const SCENE_SHADOW = {
  shadowColor: color.depth,
  shadowOpacity: 0.55,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 1 },
  elevation: 2,
} as const

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
        variant === 'outlined' && {
          borderWidth: 1,
          borderColor: OUTLINE_BORDER[colorRole],
          // A fill-less control over a live scene takes its legibility from a dark halo hugging its
          // edge. RN has no symmetric glow, so this is a shadow rather than the web's ring — the
          // documented divergence — but it does the same job the fill used to.
          ...SCENE_SHADOW,
        },
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
