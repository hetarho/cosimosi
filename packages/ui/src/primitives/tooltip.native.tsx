import { View } from 'react-native'

import type { TooltipOwnProps } from './types.ts'

export type TooltipProps = TooltipOwnProps

/**
 * React Native has no hover, so the tip is surfaced to assistive tech as a hint on
 * the trigger. A visible press/long-press popover is deferred to a later unit; the
 * cross-platform API stays identical to the web Tooltip. `side`/`align`/`wrap` are part of that API
 * and accepted here, but nothing is positioned or measured until there is a visible popover to
 * position. `press` says a tip is the CONTENT rather than a name — which is exactly the case that
 * needs the visible popover, so a screen with one keeps its explanation in the layout on native
 * instead of behind a mark that shows nothing when pressed.
 */
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <View accessibilityHint={typeof content === 'string' ? content : undefined}>{children}</View>
  )
}
