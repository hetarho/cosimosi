// Web entry for @cosimosi/ui. The package's `exports` map routes React Native
// (the `react-native` condition) to index.native.ts instead; both barrels expose
// the same primitive API so app code is platform-agnostic.

export { tokens, type Tokens, type ColorToken } from './tokens.ts'
export { cx } from './lib/cx.ts'

export {
  contrastRatio,
  relativeLuminance,
  parseHex,
  WCAG_AA_TEXT,
  WCAG_AA_LARGE,
} from './a11y/contrast.ts'
export { useReducedMotion } from './a11y/use-reduced-motion.ts'
export { useFocusTrap, type FocusTrapOptions } from './a11y/use-focus-trap.ts'

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
  ButtonOwnProps,
  IconButtonOwnProps,
  FieldOwnProps,
  ToggleOwnProps,
  DialogOwnProps,
  TooltipOwnProps,
  ToastOwnProps,
  BadgeOwnProps,
  SkeletonOwnProps,
} from './primitives/types.ts'

export { Button, type ButtonProps } from './primitives/button.tsx'
export { IconButton, type IconButtonProps } from './primitives/icon-button.tsx'
export { TextField, type TextFieldProps } from './primitives/text-field.tsx'
export { TextArea, type TextAreaProps } from './primitives/text-area.tsx'
export { Switch, type SwitchProps } from './primitives/switch.tsx'
export { Checkbox, type CheckboxProps } from './primitives/checkbox.tsx'
export { Dialog, type DialogProps } from './primitives/dialog.tsx'
export { Tooltip, type TooltipProps } from './primitives/tooltip.tsx'
export { Toast, type ToastProps } from './primitives/toast.tsx'
export { Badge, type BadgeProps } from './primitives/badge.tsx'
export { Skeleton, type SkeletonProps } from './primitives/skeleton.tsx'
export { VisuallyHidden, type VisuallyHiddenProps } from './primitives/visually-hidden.tsx'
