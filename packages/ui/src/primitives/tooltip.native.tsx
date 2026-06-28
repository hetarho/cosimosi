import { View } from 'react-native'

import type { TooltipOwnProps } from './types.ts'

export type TooltipProps = TooltipOwnProps

/**
 * React Native has no hover, so the tip is surfaced to assistive tech as a hint on
 * the trigger. A visible press/long-press popover is deferred to a later unit; the
 * cross-platform API stays identical to the web Tooltip.
 */
export function Tooltip({ content, children }: TooltipProps) {
  return <View accessibilityHint={typeof content === 'string' ? content : undefined}>{children}</View>
}
