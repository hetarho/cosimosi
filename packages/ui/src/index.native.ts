// React Native entry for @cosimosi/ui (selected by the `react-native` export
// condition). Mirrors index.ts, swapping DOM primitives for their RN siblings and
// the reduced-motion source for AccessibilityInfo. useFocusTrap is web-only — RN
// modals manage their own focus — so it is intentionally not re-exported here.

// `tokens` on native is the SAME map with RN-safe colours (native-styles.ts): RN StyleSheet cannot
// parse the OKLCH the web pipeline is authored in, and it drops what it cannot parse — a screen
// styled from the raw map renders with no ground and no ink. One source, one import name, per-platform
// encoding — the same arrangement the primitives already use.
export { nativeTokens as tokens } from './native-styles.ts'
export { type Tokens, type ColorToken } from './tokens.ts'
export { cx } from './lib/cx.ts'

export {
  contrastRatio,
  relativeLuminance,
  parseHex,
  WCAG_AA_TEXT,
  WCAG_AA_LARGE,
} from './a11y/contrast.ts'
export { useReducedMotion } from './a11y/use-reduced-motion.native.ts'

// The theme registry — the only list of themes. Native resolves the active theme statically
// (native-styles.ts bridges `palette` to RN colours); there is no `data-theme` equivalent.
export {
  themes,
  palette,
  THEME_KEYS,
  defaultThemeKey,
  isThemeKey,
  type ThemeKey,
  type ThemeDefinition,
  type ThemePalette,
} from './palette.ts'

export { useBackground, type UseBackgroundResult } from './theme/use-background.ts'
export {
  getBackgroundState,
  setBackground,
  resetBackground,
  subscribeBackground,
  type BackgroundState,
  type BackgroundTone,
} from './theme/background-store.ts'

export type {
  ButtonVariant,
  ButtonColor,
  ControlSize,
  BadgeVariant,
  AlertVariant,
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
  AlertOwnProps,
  CardOwnProps,
  SkeletonOwnProps,
  TabItem,
  TabsOwnProps,
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
export { Alert, type AlertProps } from './primitives/alert.native.tsx'
export { Card, type CardProps } from './primitives/card.native.tsx'
export { Skeleton, type SkeletonProps } from './primitives/skeleton.native.tsx'
export { VisuallyHidden, type VisuallyHiddenProps } from './primitives/visually-hidden.native.tsx'
export { Tabs, type TabsProps } from './primitives/tabs.native.tsx'
