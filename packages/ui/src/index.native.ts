// React Native entry for @cosimosi/ui (selected by the `react-native` export
// condition). Mirrors index.ts, swapping DOM primitives for their RN siblings and
// the reduced-motion source for AccessibilityInfo. useFocusTrap is web-only — RN
// modals manage their own focus — so it is intentionally not re-exported here.

export { tokens, type Tokens, type ColorToken } from './tokens.ts'
export { cx } from './lib/cx.ts'

export {
  contrastRatio,
  relativeLuminance,
  parseHex,
  WCAG_AA_TEXT,
  WCAG_AA_LARGE,
} from './a11y/contrast.ts'
export { useReducedMotion } from './a11y/use-reduced-motion.native.ts'

export { useTheme, type UseThemeResult } from './theme/use-theme.ts'
export {
  getThemeState,
  setTheme,
  setBackground,
  resetTheme,
  subscribeTheme,
  type ThemeName,
  type ThemeState,
  type BackgroundState,
  type BackgroundTone,
} from './theme/theme-store.ts'

export type {
  ButtonVariant,
  ControlSize,
  BadgeVariant,
  ToastVariant,
  CardVariant,
  ButtonOwnProps,
  IconButtonOwnProps,
  FieldOwnProps,
  ToggleOwnProps,
  DialogOwnProps,
  TooltipOwnProps,
  ToastOwnProps,
  BadgeOwnProps,
  CardOwnProps,
  SkeletonOwnProps,
} from './primitives/types.ts'

export { Button, type ButtonProps } from './primitives/button.native.tsx'
export { IconButton, type IconButtonProps } from './primitives/icon-button.native.tsx'
export { TextField, type TextFieldProps } from './primitives/text-field.native.tsx'
export { TextArea, type TextAreaProps } from './primitives/text-area.native.tsx'
export { Switch, type SwitchProps } from './primitives/switch.native.tsx'
export { Checkbox, type CheckboxProps } from './primitives/checkbox.native.tsx'
export { Dialog, type DialogProps } from './primitives/dialog.native.tsx'
export { Tooltip, type TooltipProps } from './primitives/tooltip.native.tsx'
export { Toast, type ToastProps } from './primitives/toast.native.tsx'
export { Badge, type BadgeProps } from './primitives/badge.native.tsx'
export { Card, type CardProps } from './primitives/card.native.tsx'
export { Skeleton, type SkeletonProps } from './primitives/skeleton.native.tsx'
export { VisuallyHidden, type VisuallyHiddenProps } from './primitives/visually-hidden.native.tsx'
