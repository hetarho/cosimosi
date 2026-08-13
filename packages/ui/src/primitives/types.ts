import type { ReactNode } from 'react'

/**
 * Design-system-specific prop fragments, shared by each primitive's web (*.tsx)
 * and native (*.native.tsx) implementation so the two stay API-compatible. Each
 * platform file intersects these with its element's own attributes (DOM
 * `ButtonHTMLAttributes` vs RN `PressableProps`). Platform class strings are NOT
 * shared here — web needs hover/focus-visible/ring/transition utilities that have
 * no React Native equivalent.
 *
 * Primitives take copy through props (ReactNode / string), never as embedded
 * literals, so consumers pass localized message output.
 */

/** Button APPEARANCE (emphasis). Compose with `ButtonColor` — the two axes are independent. */
export type ButtonVariant = 'contained' | 'outlined' | 'text'
/** Button COLOUR role. success/warning stay status-only (badges/toasts), not button colours. */
export type ButtonColor = 'primary' | 'secondary' | 'tertiary' | 'neutral' | 'danger'
export type ControlSize = 'sm' | 'md' | 'lg'
export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'
export type AlertVariant = 'info' | 'success' | 'warning' | 'danger'
export type CardVariant = 'solid' | 'glass'

export interface ButtonOwnProps {
  /** Appearance / emphasis. Default `contained`. */
  variant?: ButtonVariant
  /** Colour role. Default `primary`. */
  color?: ButtonColor
  size?: ControlSize
  /** Show a spinner and block interaction. */
  loading?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  children?: ReactNode
}

/**
 * The shared half of an icon's props (icons.tsx / icons.native.tsx). Only the rendered edge length
 * is cross-platform: ink comes from the control the icon sits in — `currentColor` on the web, an
 * explicit token colour on native, where RN has no inherited colour to read.
 */
export interface IconOwnProps {
  /** Edge length in px. Defaults to `ICON_SIZE`, the size design-language §8 pairs with body text. */
  size?: number
}

export interface IconButtonOwnProps {
  /** Appearance / emphasis. Default `text`. */
  variant?: ButtonVariant
  /** Colour role. Default `neutral`. */
  color?: ButtonColor
  size?: ControlSize
  loading?: boolean
  /** Accessible name for the icon-only control. Required so it is never unlabeled. */
  label: string
  icon: ReactNode
}

export interface FieldOwnProps {
  label?: ReactNode
  description?: ReactNode
  /** Error message; when present the field is marked invalid. */
  error?: ReactNode
  size?: ControlSize
}

export interface ToggleOwnProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: ReactNode
  /** Accessible name when no visible `label` is given (so the control is never unnamed). */
  ariaLabel?: string
  disabled?: boolean
}

export interface DialogOwnProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  /** Accessible name for the surface when no visible `title` is rendered. */
  ariaLabel?: string
  /** Accessible name for the close affordance (consumer passes localized copy). */
  closeLabel: string
  children?: ReactNode
}

/**
 * A surface that opens BESIDE the thing it is about, never on top of it. It has no `scrim`,
 * `overlay` or `modal` prop, and that absence is the point: the universe behind a Sheet stays
 * visible and interactive, because the whole reason to open one is to watch a change land in it.
 * A surface that must interrupt is a `Dialog` — the two are different promises, not two settings.
 */
export interface SheetOwnProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  /** Accessible name for the surface when no visible `title` is rendered. */
  ariaLabel?: string
  /** Accessible name for the close affordance (consumer passes localized copy). */
  closeLabel: string
  /** Block the close affordance while a commit is in flight, so a save cannot be orphaned. */
  closeDisabled?: boolean
  /** Pinned below the scrolling body — the surface's one commit action. */
  footer?: ReactNode
  children?: ReactNode
}

export interface TooltipOwnProps {
  content: ReactNode
  children: ReactNode
  /** Which side of the trigger the tip sits on. Default `top`. */
  side?: 'top' | 'bottom' | 'left'
  /**
   * How a `top`/`bottom` tip lines up with its trigger. `center` (default) is right for a control
   * with room on both sides; `end` pins the tip's right edge to the trigger's, which is what keeps a
   * tip wider than its control from running off the screen when the control hugs the right edge.
   * Ignored for `side: 'left'`, which centres on the trigger's height.
   */
  align?: 'center' | 'end'
}

export interface MenuItem {
  /** Stable key, and what a selection reports back. */
  value: string
  label: ReactNode
  onSelect: () => void
  /** `danger` for an item that destroys something; `neutral` (default) for everything else. */
  tone?: 'neutral' | 'danger'
  disabled?: boolean
}

/**
 * A short list of commands behind one control — the gathering place for the actions a surface has
 * room to offer but not room to show. It is not a `Select`: nothing here is a value, and the list
 * closes on the act rather than on a choice.
 *
 * Placement is the caller's to state, as it is for `Tooltip`: nothing in this package measures the
 * viewport, and the composition site is where the room around the trigger is known.
 */
export interface MenuOwnProps {
  items: readonly MenuItem[]
  /** The control that opens the list. It is cloned to carry the expanded/haspopup state. */
  trigger: ReactNode
  /** Accessible name for the list itself, so it is never announced unlabelled. */
  ariaLabel: string
  /** Which side of the trigger the list opens toward. Default `bottom`. */
  side?: 'top' | 'bottom'
  /** Which edge the list lines up with. Default `end` — the right edge, for a trigger in a corner. */
  align?: 'start' | 'end'
}

export interface ObscuredTextSpan {
  text: string
  /** This run is no longer legible — render it as a smear, not as its characters. */
  obscured: boolean
}

/**
 * Text with runs that have stopped being readable, drawn as such: the legible runs plainly, the rest
 * blurred past recognition. The component takes the runs already decided — it never decides which
 * ones are gone, and it never announces the loss with a word or a marker.
 */
export interface ObscuredTextProps {
  spans: readonly ObscuredTextSpan[]
  className?: string
}

export interface ToastOwnProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant?: ToastVariant
  /** Auto-dismiss after this many ms; omit to require manual dismissal. */
  durationMs?: number
  children?: ReactNode
}

export interface BadgeOwnProps {
  variant?: BadgeVariant
  children?: ReactNode
}

export interface AlertOwnProps {
  variant?: AlertVariant
  /**
   * How assistive tech is told. `alert` (default) for something that already failed — it interrupts;
   * `status` for a consequence being offered, which is announced politely. The choice is about
   * timing, not hue: a warning the user is about to accept is a `status`.
   */
  live?: 'alert' | 'status'
  children?: ReactNode
}

export interface CardOwnProps {
  /** `solid` = elevated opaque content panel; `glass` = glass material for cards over rich backdrops. */
  variant?: CardVariant
  children?: ReactNode
}

// A DETERMINATE meter, and only that: `value` and `max` are read verbatim from the two server
// integers an achievement row carries. There is deliberately no indeterminate mode and no computed
// ratio prop — a meter whose fill the caller computes is a meter that can disagree with its label.
export interface ProgressOwnProps {
  value: number
  max: number
  /** Announced to assistive tech; the visible label is the caller's, beside the meter. */
  ariaLabel: string
}

export interface SkeletonOwnProps {
  width?: number | string
  height?: number | string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

export interface VisuallyHiddenProps {
  children: ReactNode
}

export interface TabItem {
  value: string
  label: string
  /** The id of the panel controlled by this tab. */
  panelId: string
}

export interface SelectItem {
  value: string
  label: string
}

export interface SelectOwnProps {
  /** The whole bounded set, in the order it should read. A picker is for a set the user cannot extend. */
  items: readonly SelectItem[]
  value: string
  onValueChange: (value: string) => void
  /** Accessible name when no visible `label` is given (so the control is never unnamed). */
  ariaLabel?: string
  disabled?: boolean
}

export interface TabsOwnProps {
  items: readonly TabItem[]
  value: string
  onValueChange: (value: string) => void
  ariaLabel: string
}

export interface SegmentedControlItem {
  value: string
  label: string
}

export interface SegmentedControlOwnProps {
  /** The whole bounded set, laid out side by side — all options stay visible, unlike Select. */
  items: readonly SegmentedControlItem[]
  value: string
  onValueChange: (value: string) => void
  /** Accessible name for the group, so the choice is never announced unlabelled. */
  ariaLabel: string
  disabled?: boolean
  /**
   * Turn the control into a SWITCH: one press anywhere on it lands on the other option, rather than
   * each segment selecting itself. For a choice between exactly two — where a press on the option
   * already held is a press that does nothing, and aiming at the right half is work the reader
   * should not have to do. Requires `items.length === 2`; ignored otherwise.
   */
  toggle?: boolean
}
