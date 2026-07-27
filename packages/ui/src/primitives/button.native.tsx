import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { oklchToRnColor } from '../lib/oklch.ts'
import { color, fontSize, radius, space } from '../native-styles.ts'
import { tokens as rawTokens } from '../tokens.ts'
import type { ButtonColor, ButtonOwnProps, ControlSize } from './types.ts'

export type ButtonProps = ButtonOwnProps &
  Omit<PressableProps, 'children' | 'style'> & { style?: StyleProp<ViewStyle> }

// Two axes on native too. Contained is the same LENS the web builds, not a solid slab: the role
// colour at the web recipe's tint density over whatever ground the button sits on, a rim of the same
// role, and the plain text ink. RN has no backdrop-filter and no glow, so the blur and the halo are
// the documented divergence — but the *weight* matches, because a full-strength field of an accent
// reads as a warning in a dark interface (design-language §2.3) and left every native screen louder
// than its web twin. The mixes are resolved from the one OKLCH source via `oklchToRnColor`.
// The web recipe's densities: a 46% role tint behind a 38% rim of the same role. Neutral is the quiet
// surface colour, so it carries the web's denser neutral tint — at 46% it would barely register.
const TINT = 0.46
const NEUTRAL_TINT = 0.52
const RIM = 0.38

const tint = (role: string, alpha: number) => oklchToRnColor(role, alpha)

const CONTAINED_BG: Record<ButtonColor, string> = {
  primary: tint(rawTokens.color.primary, TINT),
  secondary: tint(rawTokens.color.secondary, TINT),
  tertiary: tint(rawTokens.color.tertiary, TINT),
  neutral: tint(rawTokens.color['surface-raised'], NEUTRAL_TINT),
  danger: tint(rawTokens.color.danger, TINT),
}
const CONTAINED_BORDER: Record<ButtonColor, string> = {
  primary: tint(rawTokens.color.primary, RIM),
  secondary: tint(rawTokens.color.secondary, RIM),
  tertiary: tint(rawTokens.color.tertiary, RIM),
  neutral: tint(rawTokens.color['surface-raised'], RIM),
  danger: tint(rawTokens.color.danger, RIM),
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
  // Contained keeps the plain text ink like the web lens does; the `-foreground` pairs belong to a
  // full-strength fill, which this no longer is.
  const fg = variant === 'contained' ? color.text : INK[colorRole]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: bg, height: HEIGHT[size], paddingHorizontal: PAD_X[size] },
        variant === 'contained' && { borderWidth: 1, borderColor: CONTAINED_BORDER[colorRole] },
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
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    borderRadius: radius.md,
  },
  disabled: { opacity: 0.5 },
})
