// Web entry for @cosimosi/ui. The package's `exports` map routes React Native
// (the `react-native` condition) to index.native.ts instead; both barrels expose
// the same primitive API so app code is platform-agnostic.

export { tokens, type Tokens, type ColorToken } from './tokens.ts'
export { cx } from './lib/cx.ts'

// The queued-toast seam: one Toast in the tree, two owners pushing into it.
export {
  ACHIEVEMENT_NOTICE_TOAST_OWNER,
  SESSION_SCOPED_TOAST_OWNERS,
  ToastQueueContext,
  usePushToast,
  useToastQueue,
  type PushToast,
  type ToastEntry,
  type ToastQueue,
} from './toast-queue.ts'

export {
  contrastRatio,
  relativeLuminance,
  parseHex,
  WCAG_AA_TEXT,
  WCAG_AA_LARGE,
} from './a11y/contrast.ts'
export { useReducedMotion } from './a11y/use-reduced-motion.ts'
export { useFocusTrap, type FocusTrapOptions } from './a11y/use-focus-trap.ts'
export { usePresence, type Presence, type PresencePhase } from './a11y/use-presence.ts'

// The theme registry — the only list of themes. Surfaces that show or resolve a theme read it from
// here rather than repeating the names (palette.ts).
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
  SheetOwnProps,
  TooltipOwnProps,
  ToastOwnProps,
  BadgeOwnProps,
  AlertOwnProps,
  CardOwnProps,
  SkeletonOwnProps,
  IconOwnProps,
  ProgressOwnProps,
  SelectItem,
  SelectOwnProps,
  TabItem,
  TabsOwnProps,
  SegmentedControlItem,
  SegmentedControlOwnProps,
} from './primitives/types.ts'

export { Button, type ButtonProps } from './primitives/button.tsx'
export { IconButton, type IconButtonProps } from './primitives/icon-button.tsx'
// The icon set — product meanings, not glyph names (icons.tsx owns the binding).
export {
  ICON_SIZE,
  DecorateIcon,
  DiaryIcon,
  NoticeIcon,
  SettingsIcon,
  TwinkleGeneralIcon,
  TwinkleSmallIcon,
  type IconProps,
} from './primitives/icons.tsx'
export { TextField, type TextFieldProps } from './primitives/text-field.tsx'
export { Select, type SelectProps } from './primitives/select.tsx'
export { TextArea, type TextAreaProps } from './primitives/text-area.tsx'
export { Switch, type SwitchProps } from './primitives/switch.tsx'
export { Checkbox, type CheckboxProps } from './primitives/checkbox.tsx'
export { Dialog, type DialogProps } from './primitives/dialog.tsx'
export { Sheet, type SheetProps } from './primitives/sheet.tsx'
export { Tooltip, type TooltipProps } from './primitives/tooltip.tsx'
export { Toast, type ToastProps } from './primitives/toast.tsx'
export { Badge, type BadgeProps } from './primitives/badge.tsx'
export { Alert, type AlertProps } from './primitives/alert.tsx'
export { Card, type CardProps } from './primitives/card.tsx'
export { Skeleton, type SkeletonProps } from './primitives/skeleton.tsx'
export { Progress, type ProgressProps } from './primitives/progress.tsx'
export { VisuallyHidden, type VisuallyHiddenProps } from './primitives/visually-hidden.tsx'
// Web only: it draws to a canvas. A native sibling arrives when a mobile surface asks for the solid.
export { BrandMark, type BrandMarkProps } from './primitives/brand-mark.tsx'
export { Tabs, type TabsProps } from './primitives/tabs.tsx'
export { SegmentedControl, type SegmentedControlProps } from './primitives/segmented-control.tsx'
